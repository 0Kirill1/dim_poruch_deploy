package dimporuchbe.listings.application;

import dimporuchbe.listings.api.dtos.CreateListingRequestDto;
import dimporuchbe.listings.api.dtos.ListingImageDto;
import dimporuchbe.listings.persistence.*;
import dimporuchbe.user.persistence.Role;
import dimporuchbe.user.persistence.User;
import dimporuchbe.user.persistence.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ListingServiceLifecycleTest {
    @Mock ListingRepository listingRepository;
    @Mock ListingImageRepository imageRepository;
    @Mock UserRepository userRepository;
    @Mock ListingImageStorageService storage;
    ListingService service;
    User owner;
    Listing listing;
    UUID listingId;

    @BeforeEach
    void setUp() {
        service = new ListingService(listingRepository, imageRepository, userRepository, storage);
        owner = User.builder().id(UUID.randomUUID()).email("owner@example.com")
                .role(Role.LANDLORD).status("ACTIVE").build();
        listingId = UUID.randomUUID();
        listing = Listing.builder().id(listingId).owner(owner).status(Status.ACTIVE)
                .title("A comfortable apartment").build();
        when(userRepository.findByEmail(owner.getEmail())).thenReturn(Optional.of(owner));
    }

    @Test
    void creationUsesModerationStatusAndDefaultsAmenities() {
        CreateListingRequestDto dto = new CreateListingRequestDto();
        dto.setTitle("A comfortable apartment");
        dto.setDescription("Description");
        dto.setCity("Kyiv"); dto.setAddress("Main street 1");
        dto.setMonthlyPrice(BigDecimal.valueOf(900)); dto.setRooms((short) 2);
        dto.setPropertyType("APARTMENT"); dto.setAmenities(null);
        service.createListing(dto, owner.getEmail());
        org.mockito.ArgumentCaptor<Listing> captor = org.mockito.ArgumentCaptor.forClass(Listing.class);
        verify(listingRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(Status.MODERATION);
        assertThat(captor.getValue().getAmenities()).isEmpty();
        assertThat(captor.getValue().getOwner()).isEqualTo(owner);
    }

    @Test
    void statusToggleAndArchivePersistRequestedStatus() {
        when(listingRepository.findById(listingId)).thenReturn(Optional.of(listing));

        assertThat(service.updateListingStatus(listingId, Status.ARCHIVED, owner.getEmail()).getStatus())
                .isEqualTo("ARCHIVED");
        assertThat(listing.getStatus()).isEqualTo(Status.ARCHIVED);
        service.deleteListing(listingId, owner.getEmail());
        assertThat(listing.getStatus()).isEqualTo(Status.ARCHIVED);
        verify(listingRepository, times(2)).save(listing);
    }

    @Test
    void statusToggleRejectsModeration() {
        when(listingRepository.findById(listingId)).thenReturn(Optional.of(listing));

        assertThatThrownBy(() -> service.updateListingStatus(listingId, Status.MODERATION, owner.getEmail()))
                .isInstanceOf(ResponseStatusException.class);
        verify(listingRepository, never()).save(any());
    }

    @Test
    void firstImageBecomesPrimaryAndStorageFailureCleansUp() {
        when(listingRepository.findById(listingId)).thenReturn(Optional.of(listing));

        MockMultipartFile file = new MockMultipartFile("file", "x.png", "image/png", new byte[]{1});
        when(imageRepository.findByListingIdOrderByCreatedAtAsc(listingId)).thenReturn(List.of());
        when(imageRepository.saveAndFlush(any())).thenAnswer(invocation -> {
            ListingImage image = invocation.getArgument(0);
            if (image.getId() == null) image.setId(UUID.randomUUID());
            return image;
        });
        ListingImageDto result = service.addImage(listingId, file, false, owner.getEmail());
        assertThat(result.getIsPrimary()).isTrue();
        verify(storage).store(eq(listingId), any(), eq(file));

        doThrow(new IllegalStateException("disk full")).when(storage)
                .store(eq(listingId), any(), eq(file));
        assertThatThrownBy(() -> service.addImage(listingId, file, false, owner.getEmail()))
                .isInstanceOf(IllegalStateException.class);
        verify(storage).delete(eq(listingId), any());
    }

    @Test
    void deletingPrimaryPromotesOldestRemainingImage() {
        when(listingRepository.findById(listingId)).thenReturn(Optional.of(listing));

        ListingImage primary = ListingImage.builder().id(UUID.randomUUID()).listing(listing)
                .imageUrl("one").isPrimary(true).build();
        ListingImage remaining = ListingImage.builder().id(UUID.randomUUID()).listing(listing)
                .imageUrl("two").isPrimary(false).build();
        when(imageRepository.findById(primary.getId())).thenReturn(Optional.of(primary));
        when(imageRepository.findByListingIdOrderByCreatedAtAsc(listingId)).thenReturn(List.of(remaining));
        service.deleteImage(listingId, primary.getId(), owner.getEmail());
        assertThat(remaining.getIsPrimary()).isTrue();
        verify(imageRepository).save(remaining);
        verify(storage).delete(listingId, primary.getId());
    }
}
