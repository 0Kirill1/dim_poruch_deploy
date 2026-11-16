package dimporuchbe.reviews.application;

import dimporuchbe.bookings.persistence.*;
import dimporuchbe.listings.persistence.*;
import dimporuchbe.reviews.api.dtos.*;
import dimporuchbe.reviews.persistence.*;
import dimporuchbe.user.persistence.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReviewServiceTest {
    @Mock ReviewRepository reviews;
    @Mock UserRepository users;
    @Mock BookingRepository bookings;
    @Mock ListingRepository listings;
    ReviewService service;
    User tenant, owner, stranger;
    Listing listing;
    Booking booking;
    UUID bookingId, listingId;

    @BeforeEach
    void setUp() {
        service = new ReviewService(reviews, users, bookings, listings);
        tenant = user("tenant@example.com");
        owner = user("owner@example.com");
        stranger = user("other@example.com");
        listingId = UUID.randomUUID(); bookingId = UUID.randomUUID();
        listing = Listing.builder().id(listingId).owner(owner).build();
        booking = Booking.builder().id(bookingId).listing(listingId).tenant(tenant.getId())
                .status(BookingStatus.COMPLETED).build();
    }

    @Test
    void onlyTenantOfCompletedBookingMayReviewAndDuplicateIsRejected() {
        when(users.findByEmail(tenant.getEmail())).thenReturn(Optional.of(tenant));
        when(bookings.findById(bookingId)).thenReturn(Optional.of(booking));

        CreateReviewDto dto = new CreateReviewDto(); dto.setRating((short) 5); dto.setComment("Great");
        when(reviews.save(any())).thenAnswer(i -> i.getArgument(0));
        assertThat(service.createReview(dto, bookingId, tenant.getEmail()).getStatus()).isEqualTo("PENDING");
        verify(reviews).save(any(Review.class));

        when(reviews.existsByAuthorAndBooking(tenant.getId(), bookingId)).thenReturn(true);
        assertThatThrownBy(() -> service.createReview(dto, bookingId, tenant.getEmail()))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode().value()).isEqualTo(409));
        booking.setStatus(BookingStatus.PENDING);
        assertThatThrownBy(() -> service.createReview(dto, bookingId, tenant.getEmail()))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                       assertThat(e.getStatusCode().value()).isEqualTo(403));
    }

    @Test
    void nonTenantCannotReviewBooking() {
        when(bookings.findById(bookingId)).thenReturn(Optional.of(booking));
        when(users.findByEmail(stranger.getEmail())).thenReturn(Optional.of(stranger));
        assertThatThrownBy(() -> service.createReview(new CreateReviewDto(), bookingId, stranger.getEmail()))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode().value()).isEqualTo(403));
        verify(reviews, never()).save(any());
    }

    @Test
    void onlyListingOwnerMayReplyToReview() {
        when(bookings.findById(bookingId)).thenReturn(Optional.of(booking));

        Review review = Review.builder().id(UUID.randomUUID()).booking(bookingId)
                .author(tenant.getId()).rating((short) 4).status(ReviewStatus.APPROVED).build();
        when(reviews.findById(review.getId())).thenReturn(Optional.of(review));
        when(listings.findById(listingId)).thenReturn(Optional.of(listing));
        ReviewReplyRequestDto reply = new ReviewReplyRequestDto("Thanks!");
        when(reviews.save(any())).thenAnswer(i -> i.getArgument(0));
        when(users.findByEmail(owner.getEmail())).thenReturn(Optional.of(owner));
        assertThat(service.replyToReview(review.getId(), reply, owner.getEmail()).getReply()).isEqualTo("Thanks!");
        verify(reviews).save(review);

        when(users.findByEmail(stranger.getEmail())).thenReturn(Optional.of(stranger));
        assertThatThrownBy(() -> service.replyToReview(review.getId(), reply, stranger.getEmail()))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode().value()).isEqualTo(403));
    }

    private User user(String email) {
        return User.builder().id(UUID.randomUUID()).email(email).role(Role.TENANT).status("ACTIVE").build();
    }
}
