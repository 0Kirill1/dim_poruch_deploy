package dimporuchbe.bookings.application;

import dimporuchbe.bookings.api.dtos.AvailabilityRangeDto;
import dimporuchbe.bookings.api.dtos.BookingDto;
import dimporuchbe.bookings.api.dtos.CreateBookingDto;
import dimporuchbe.bookings.api.dtos.CreateBookingResponseDto;
import dimporuchbe.bookings.events.BookingCreatedEvent;
import dimporuchbe.bookings.events.BookingStatusChangedEvent;
import dimporuchbe.bookings.persistence.Booking;
import dimporuchbe.bookings.persistence.BookingRepository;
import dimporuchbe.bookings.persistence.BookingStatus;
import dimporuchbe.listings.persistence.Listing;
import dimporuchbe.listings.persistence.ListingRepository;
import dimporuchbe.listings.persistence.Status;
import dimporuchbe.user.persistence.User;
import dimporuchbe.user.persistence.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BookingService {
    private final ListingRepository listingRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public CreateBookingResponseDto createBooking(CreateBookingDto dto, String email){
        User user = userRepository.findByEmail(email).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if(dto.getStartDate().isBefore(LocalDate.now())){
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Start date cannot be in the past");
        }

        if(dto.getEndDate().isBefore(dto.getStartDate()) || dto.getEndDate().isEqual(dto.getStartDate())){
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "End date should be after start date");
        }

        Listing listing = listingRepository.findById(dto.getListing())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found"));

        if(listing.getStatus() != Status.ACTIVE){
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Listing is not active for booking");
        }

        if(listing.getOwner().getId().equals(user.getId())){
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Landlords cannot book their own listings");
        }

        boolean isOverlap = bookingRepository.existsOverLappingBooking(
                dto.getListing(),
                dto.getStartDate(),
                dto.getEndDate()
        );

        if(isOverlap){
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Picked dates are already booked.");
        }

        Booking booking = Booking.builder()
                .listing(dto.getListing())
                .tenant(user.getId())
                .startDate(dto.getStartDate())
                .endDate(dto.getEndDate())
                .message(dto.getMessage())
                .status(BookingStatus.PENDING)
                .createdAt(OffsetDateTime.now())
                .build();
        Booking savedBooking = bookingRepository.save(booking);

        eventPublisher.publishEvent(new BookingCreatedEvent(
                this,
                savedBooking.getId(),
                savedBooking.getListing(),
                listing.getOwner().getId(),
                user.getId(),
                savedBooking.getStartDate(),
                savedBooking.getEndDate()
        ));

        return CreateBookingResponseDto.builder()
                .id(savedBooking.getId())
                .createdAt(savedBooking.getCreatedAt())
                .build();
    }

    @Transactional(readOnly = true)
    public List<BookingDto> getBookings(String email){
        User user = userRepository.findByEmail(email).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        List<Booking> bookings = bookingRepository.findAllByTenantId(user.getId());

        if(bookings.isEmpty()){
            return Collections.emptyList();
        }

        List<BookingDto> result = new ArrayList<>();
        bookings.forEach(booking -> result.add(mapToDto(booking)));

        return result;
    }

    @Transactional(readOnly = true)
    public Page<BookingDto> getLandlordBookings(String email, BookingStatus status, Pageable pageable){
        User user = userRepository.findByEmail(email).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        List<UUID> listingIds = listingRepository.findIdsByOwnerId(user);

        if(listingIds.isEmpty()){
            return Page.empty(pageable);
        }

        Page<Booking> bookings = bookingRepository.findByListingIdsAndOptionalStatus(listingIds, status, pageable);
        return bookings.map(this::mapToDto);
    }

    @Transactional
    public BookingDto updateStatus(UUID id, BookingStatus newStatus, String email){
        User user = userRepository.findByEmail(email).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        Booking booking = bookingRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        Listing listing = listingRepository.findById(booking.getListing())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Associated listing not found"));

        boolean isLandlord = listing.getOwner().getId().equals(user.getId());
        boolean isTenant = booking.getTenant().equals(user.getId());

        if (newStatus == BookingStatus.CANCELLED || newStatus == BookingStatus.COMPLETED) {
            if (!isLandlord && !isTenant) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only tenant or landlord can cancel or complete this booking");
            }
        } else if (newStatus == BookingStatus.APPROVED || newStatus == BookingStatus.REJECTED) {
            if (!isLandlord) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the listing owner can approve or reject this booking");
            }
        } else {
            if (!isLandlord) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the listing owner can update this booking status");
            }
        }

        BookingStatus oldStatus = booking.getStatus();
        booking.setStatus(newStatus);
        booking.setUpdatedAt(OffsetDateTime.now());
        Booking updated = bookingRepository.save(booking);

        eventPublisher.publishEvent(new BookingStatusChangedEvent(
                this,
                updated.getId(),
                updated.getListing(),
                updated.getTenant(),
                listing.getOwner().getId(),
                oldStatus,
                newStatus
        ));

        return mapToDto(updated);
    }

    @Transactional(readOnly = true)
    public List<AvailabilityRangeDto> getListingAvailability(UUID listingId){
        if (!listingRepository.existsById(listingId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found");
        }

        List<Booking> activeBookings = bookingRepository.findFutureBookingsForListing(listingId, LocalDate.now());
        return activeBookings.stream()
                .map(b -> AvailabilityRangeDto.builder()
                        .startDate(b.getStartDate())
                        .endDate(b.getEndDate())
                        .build())
                .collect(Collectors.toList());
    }

    @Scheduled(cron = "0 0 0 * * *")
    @Transactional
    public void activateStartedBookings(){
        List<Booking> bookingsToActivate = bookingRepository.findBookingsToActivate();
        for(Booking booking : bookingsToActivate){
            booking.setStatus(BookingStatus.ACTIVE);
            bookingRepository.save(booking);
            Listing listing = listingRepository.findById(booking.getListing()).get();
            eventPublisher.publishEvent(new BookingStatusChangedEvent(
                    this,
                    booking.getId(),
                    booking.getListing(),
                    booking.getTenant(),
                    listing.getOwner().getId(),
                    BookingStatus.APPROVED,
                    BookingStatus.ACTIVE
            ));
        }
    }

    private BookingDto mapToDto(Booking booking){
        return BookingDto.builder()
                .id(booking.getId())
                .listing(booking.getListing())
                .tenant(booking.getTenant())
                .startDate(booking.getStartDate())
                .endDate(booking.getEndDate())
                .status(booking.getStatus().name())
                .message(booking.getMessage())
                .build();
    }
}
