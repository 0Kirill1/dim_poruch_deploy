package dimporuchbe.bookings.application;

import dimporuchbe.bookings.api.dtos.CreateBookingDto;
import dimporuchbe.bookings.api.dtos.CreateBookingResponseDto;
import dimporuchbe.bookings.events.BookingCreatedEvent;
import dimporuchbe.bookings.events.BookingStatusChangedEvent;
import dimporuchbe.bookings.api.dtos.BookingDto;
import dimporuchbe.bookings.persistence.BookingStatus;
import dimporuchbe.bookings.persistence.Booking;
import dimporuchbe.bookings.persistence.BookingRepository;
import dimporuchbe.listings.persistence.Listing;
import dimporuchbe.listings.persistence.ListingRepository;
import dimporuchbe.listings.persistence.Status;
import dimporuchbe.user.persistence.Role;
import dimporuchbe.user.persistence.User;
import dimporuchbe.user.persistence.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingServiceTest {

    private static final String TENANT_EMAIL = "tenant@example.com";

    @Mock
    private ListingRepository listingRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    private BookingService bookingService;
    private UUID listingId;
    private User tenant;
    private Listing listing;

    @BeforeEach
    void setUp() {
        bookingService = new BookingService(
                listingRepository,
                bookingRepository,
                userRepository,
                eventPublisher
        );

        listingId = UUID.randomUUID();
        tenant = User.builder()
                .id(UUID.randomUUID())
                .email(TENANT_EMAIL)
                .role(Role.TENANT)
                .status("ACTIVE")
                .build();
        User owner = User.builder()
                .id(UUID.randomUUID())
                .email("owner@example.com")
                .role(Role.LANDLORD)
                .status("ACTIVE")
                .build();
        listing = Listing.builder()
                .id(listingId)
                .owner(owner)
                .status(Status.ACTIVE)
                .build();

        when(userRepository.findByEmail(TENANT_EMAIL)).thenReturn(Optional.of(tenant));
    }

    @Test
    void createBookingRejectsDatesOverlappingAnExistingBooking() {
        when(listingRepository.findById(listingId)).thenReturn(Optional.of(listing));

        LocalDate startDate = LocalDate.now().plusDays(10);
        LocalDate endDate = startDate.plusDays(5);
        CreateBookingDto dto = bookingDto(startDate, endDate);

        when(bookingRepository.existsOverLappingBooking(listingId, startDate, endDate))
                .thenReturn(true);

        assertThatThrownBy(() -> bookingService.createBooking(dto, TENANT_EMAIL))
                .isInstanceOfSatisfying(ResponseStatusException.class, exception -> {
                    assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(exception.getReason()).contains("already booked");
                });

        verify(bookingRepository, never()).save(any(Booking.class));
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void createBookingAllowsAReservationStartingWhenAnotherOneEnds() {
        when(listingRepository.findById(listingId)).thenReturn(Optional.of(listing));

        LocalDate startDate = LocalDate.now().plusDays(10);
        LocalDate endDate = startDate.plusDays(5);
        CreateBookingDto dto = bookingDto(startDate, endDate);
        Booking savedBooking = Booking.builder()
                .id(UUID.randomUUID())
                .listing(listingId)
                .tenant(tenant.getId())
                .startDate(startDate)
                .endDate(endDate)
                .createdAt(OffsetDateTime.now())
                .build();

        when(bookingRepository.existsOverLappingBooking(listingId, startDate, endDate))
                .thenReturn(false);
        when(bookingRepository.save(any(Booking.class))).thenReturn(savedBooking);

        CreateBookingResponseDto response = bookingService.createBooking(dto, TENANT_EMAIL);

        assertThat(response.getId()).isEqualTo(savedBooking.getId());
        verify(bookingRepository).existsOverLappingBooking(eq(listingId), eq(startDate), eq(endDate));
        verify(bookingRepository).save(any(Booking.class));
        verify(eventPublisher).publishEvent(any(BookingCreatedEvent.class));
    }

    @Test
    void createBookingRejectsPastStartAndNonPositiveDates() {
        assertBadBooking(LocalDate.now().minusDays(1), LocalDate.now().plusDays(1));
        assertBadBooking(LocalDate.now().plusDays(2), LocalDate.now().plusDays(2));
        assertBadBooking(LocalDate.now().plusDays(3), LocalDate.now().plusDays(2));
        verify(bookingRepository, never()).existsOverLappingBooking(any(), any(), any());
    }

    @Test
    void createBookingRejectsInactiveListingAndOwnerSelfBooking() {
        when(listingRepository.findById(listingId)).thenReturn(Optional.of(listing));

        listing.setStatus(Status.ARCHIVED);
        assertThatThrownBy(() -> bookingService.createBooking(
                bookingDto(LocalDate.now().plusDays(1), LocalDate.now().plusDays(2)), TENANT_EMAIL))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));

        listing.setStatus(Status.ACTIVE);
        tenant.setId(listing.getOwner().getId());
        assertThatThrownBy(() -> bookingService.createBooking(
                bookingDto(LocalDate.now().plusDays(1), LocalDate.now().plusDays(2)), TENANT_EMAIL))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(bookingRepository, never()).save(any());
    }

    @Test
    void successfulBookingSetsPendingPayloadAndPublishesEvent() {
        when(listingRepository.findById(listingId)).thenReturn(Optional.of(listing));

        LocalDate start = LocalDate.now().plusDays(3);
        LocalDate end = start.plusDays(2);
        Booking saved = Booking.builder().id(UUID.randomUUID()).listing(listingId)
                .tenant(tenant.getId()).startDate(start).endDate(end)
                .message("hello").status(BookingStatus.PENDING).createdAt(OffsetDateTime.now()).build();
        when(bookingRepository.save(any())).thenAnswer(invocation -> {
            Booking b = invocation.getArgument(0);
            b.setId(saved.getId());
            b.setCreatedAt(saved.getCreatedAt());
            return b;
        });

        CreateBookingResponseDto response = bookingService.createBooking(bookingDto(start, end), TENANT_EMAIL);
        assertThat(response.getId()).isEqualTo(saved.getId());
        org.mockito.ArgumentCaptor<Booking> captor = org.mockito.ArgumentCaptor.forClass(Booking.class);
        verify(bookingRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(BookingStatus.PENDING);
        assertThat(captor.getValue().getTenant()).isEqualTo(tenant.getId());
        verify(eventPublisher).publishEvent(any(BookingCreatedEvent.class));
    }

    @Test
    void updateStatusRequiresLandlordForApprovalAndPublishesChange() {
        when(listingRepository.findById(listingId)).thenReturn(Optional.of(listing));

        UUID bookingId = UUID.randomUUID();
        Booking booking = Booking.builder().id(bookingId).listing(listingId).tenant(tenant.getId())
                .status(BookingStatus.PENDING).startDate(LocalDate.now().plusDays(1))
                .endDate(LocalDate.now().plusDays(2)).build();
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(userRepository.findByEmail(TENANT_EMAIL)).thenReturn(Optional.of(tenant));
        assertThatThrownBy(() -> bookingService.updateStatus(bookingId, BookingStatus.APPROVED, TENANT_EMAIL))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));

        User owner = listing.getOwner();
        when(userRepository.findByEmail(owner.getEmail())).thenReturn(Optional.of(owner));
        when(bookingRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        BookingDto result = bookingService.updateStatus(bookingId, BookingStatus.APPROVED, owner.getEmail());
        assertThat(result.getStatus()).isEqualTo("APPROVED");
        verify(eventPublisher).publishEvent(any(BookingStatusChangedEvent.class));
    }

    @Test
    void updateStatusAllowsTenantCancellationButRejectsUnrelatedUser() {
        when(listingRepository.findById(listingId)).thenReturn(Optional.of(listing));

        UUID bookingId = UUID.randomUUID();
        Booking booking = Booking.builder().id(bookingId).listing(listingId).tenant(tenant.getId())
                .status(BookingStatus.PENDING).build();
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        assertThat(bookingService.updateStatus(bookingId, BookingStatus.CANCELLED, TENANT_EMAIL).getStatus())
                .isEqualTo("CANCELLED");
        User stranger = User.builder().id(UUID.randomUUID()).email("stranger@example.com").build();
        when(userRepository.findByEmail(stranger.getEmail())).thenReturn(Optional.of(stranger));
        assertThatThrownBy(() -> bookingService.updateStatus(bookingId, BookingStatus.CANCELLED, stranger.getEmail()))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    private void assertBadBooking(LocalDate start, LocalDate end) {
        assertThatThrownBy(() -> bookingService.createBooking(bookingDto(start, end), TENANT_EMAIL))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    private CreateBookingDto bookingDto(LocalDate startDate, LocalDate endDate) {
        CreateBookingDto dto = new CreateBookingDto();
        dto.setListing(listingId);
        dto.setStartDate(startDate);
        dto.setEndDate(endDate);
        dto.setMessage("I would like to rent this listing");
        return dto;
    }
}
