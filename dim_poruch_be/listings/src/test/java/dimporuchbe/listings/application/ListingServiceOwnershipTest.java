package dimporuchbe.listings.application;

import dimporuchbe.listings.api.dtos.ListingDto;
import dimporuchbe.listings.api.dtos.UpdateListingDto;
import dimporuchbe.listings.persistence.Listing;
import dimporuchbe.listings.persistence.ListingImageRepository;
import dimporuchbe.listings.persistence.ListingRepository;
import dimporuchbe.listings.persistence.PropertyType;
import dimporuchbe.listings.persistence.Status;
import dimporuchbe.user.persistence.Role;
import dimporuchbe.user.persistence.User;
import dimporuchbe.user.persistence.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ListingServiceOwnershipTest {

    private static final String OWNER_EMAIL = "owner@example.com";
    private static final String OTHER_USER_EMAIL = "other@example.com";

    @Mock
    private ListingRepository listingRepository;

    @Mock
    private ListingImageRepository listingImageRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ListingImageStorageService listingImageStorageService;

    private ListingService listingService;
    private UUID listingId;
    private User owner;
    private User otherUser;
    private Listing listing;

    @BeforeEach
    void setUp() {
        listingService = new ListingService(
                listingRepository,
                listingImageRepository,
                userRepository,
                listingImageStorageService
        );

        listingId = UUID.randomUUID();
        owner = user(OWNER_EMAIL);
        otherUser = user(OTHER_USER_EMAIL);
        listing = Listing.builder()
                .id(listingId)
                .owner(owner)
                .title("A bright apartment")
                .description("A listing description")
                .city("Kyiv")
                .address("1 Example Street")
                .monthlyPrice(BigDecimal.valueOf(1200))
                .rooms((short) 2)
                .propertyType(PropertyType.APARTMENT)
                .status(Status.ACTIVE)
                .build();

        when(listingRepository.findById(listingId)).thenReturn(Optional.of(listing));
    }

    @Test
    void nonOwnerCannotUpdateListingDetails() {
        when(userRepository.findByEmail(OTHER_USER_EMAIL)).thenReturn(Optional.of(otherUser));
        UpdateListingDto update = new UpdateListingDto();
        update.setTitle("Changed by someone else");

        assertThatThrownBy(() -> listingService.updateListing(listingId, update, OTHER_USER_EMAIL))
                .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                        assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));

        assertThat(listing.getTitle()).isEqualTo("A bright apartment");
        verify(listingRepository, never()).save(any(Listing.class));
    }

    @Test
    void nonOwnerCannotChangeListingStatus() {
        when(userRepository.findByEmail(OTHER_USER_EMAIL)).thenReturn(Optional.of(otherUser));

        assertThatThrownBy(() -> listingService.updateListingStatus(listingId, Status.ARCHIVED, OTHER_USER_EMAIL))
                .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                        assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));

        assertThat(listing.getStatus()).isEqualTo(Status.ACTIVE);
        verify(listingRepository, never()).save(any(Listing.class));
    }

    @Test
    void nonOwnerCannotArchiveListing() {
        when(userRepository.findByEmail(OTHER_USER_EMAIL)).thenReturn(Optional.of(otherUser));

        assertThatThrownBy(() -> listingService.deleteListing(listingId, OTHER_USER_EMAIL))
                .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                        assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));

        assertThat(listing.getStatus()).isEqualTo(Status.ACTIVE);
        verify(listingRepository, never()).save(any(Listing.class));
    }

    @Test
    void ownerCanUpdateListingDetails() {
        when(userRepository.findByEmail(OWNER_EMAIL)).thenReturn(Optional.of(owner));
        UpdateListingDto update = new UpdateListingDto();
        update.setTitle("Updated apartment title");

        ListingDto result = listingService.updateListing(listingId, update, OWNER_EMAIL);

        assertThat(result.getTitle()).isEqualTo("Updated apartment title");
        assertThat(listing.getTitle()).isEqualTo("Updated apartment title");
        verify(listingRepository).save(listing);
    }

    private User user(String email) {
        return User.builder()
                .id(UUID.randomUUID())
                .email(email)
                .role(Role.LANDLORD)
                .status("ACTIVE")
                .build();
    }
}
