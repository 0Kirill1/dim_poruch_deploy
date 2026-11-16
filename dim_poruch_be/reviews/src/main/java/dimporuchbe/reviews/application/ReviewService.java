package dimporuchbe.reviews.application;

import dimporuchbe.bookings.persistence.Booking;
import dimporuchbe.bookings.persistence.BookingRepository;
import dimporuchbe.bookings.persistence.BookingStatus;
import dimporuchbe.listings.persistence.Listing;
import dimporuchbe.listings.persistence.ListingRepository;
import dimporuchbe.reviews.api.dtos.CreateReviewDto;
import dimporuchbe.reviews.api.dtos.ListingRatingDto;
import dimporuchbe.reviews.api.dtos.ReviewDto;
import dimporuchbe.reviews.api.dtos.ReviewReplyRequestDto;
import dimporuchbe.reviews.persistence.Review;
import dimporuchbe.reviews.persistence.ReviewRepository;
import dimporuchbe.reviews.persistence.ReviewStatus;
import dimporuchbe.user.persistence.User;
import dimporuchbe.user.persistence.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReviewService {
    private final ReviewRepository reviewRepository;
    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;
    private final ListingRepository listingRepository;

    @Transactional
    public ReviewDto createReview(CreateReviewDto dto, UUID bookingId, String email){
        User user = userRepository.findByEmail(email).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        Booking booking = bookingRepository.findById(bookingId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

        if(!booking.getTenant().equals(user.getId())){
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is not allowed to review this booking.");
        }

        if(!booking.getStatus().equals(BookingStatus.COMPLETED)){
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Booking is not completed yet.");
        }

        if(reviewRepository.existsByAuthorAndBooking(user.getId(), bookingId)){
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User already left a review for this booking.");
        }

        Review review = Review.builder()
                .booking(bookingId)
                .author(user.getId())
                .rating(dto.getRating())
                .comment(dto.getComment())
                .status(ReviewStatus.PENDING)
                .createdAt(OffsetDateTime.now())
                .build();

        Review saved = reviewRepository.save(review);
        return mapToDto(saved);
    }

    @Transactional(readOnly = true)
    public List<ReviewDto> getBookingReviews(UUID booking){
        if(bookingRepository.findById(booking).isEmpty()){
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found.");
        }

        List<Review> reviews = reviewRepository.findByBooking(booking);
        return reviews.stream().map(this::mapToDto).toList();
    }

    @Transactional(readOnly = true)
    public Page<ReviewDto> getListingReviews(UUID listingId, Pageable pageable){
        if(!listingRepository.existsById(listingId)){
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found.");
        }

        return reviewRepository.findByListingIdAndStatus(listingId, ReviewStatus.APPROVED, pageable)
                .map(this::mapToDto);
    }

    @Transactional(readOnly = true)
    public ListingRatingDto getListingRating(UUID listingId){
        if(!listingRepository.existsById(listingId)){
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found.");
        }

        Double avg = reviewRepository.getAverageRatingForListing(listingId);
        Long count = reviewRepository.getReviewCountForListing(listingId);

        return ListingRatingDto.builder()
                .listingId(listingId)
                .averageRating(avg != null ? Math.round(avg * 100.0) / 100.0 : 0.0)
                .reviewCount(count != null ? count : 0L)
                .build();
    }

    @Transactional
    public ReviewDto replyToReview(UUID reviewId, ReviewReplyRequestDto dto, String email){
        User user = userRepository.findByEmail(email).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        Review review = reviewRepository.findById(reviewId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found"));
        Booking booking = bookingRepository.findById(review.getBooking()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Associated booking not found"));
        Listing listing = listingRepository.findById(booking.getListing()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Associated listing not found"));

        if(!listing.getOwner().getId().equals(user.getId())){
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the listing owner can reply to this review");
        }

        review.setReply(dto.getReply());
        review.setRepliedAt(OffsetDateTime.now());
        Review saved = reviewRepository.save(review);

        return mapToDto(saved);
    }

    private ReviewDto mapToDto(Review review){
        return ReviewDto.builder()
                .id(review.getId())
                .booking(review.getBooking())
                .author(review.getAuthor())
                .rating(review.getRating())
                .comment(review.getComment())
                .status(review.getStatus().name())
                .createdAt(review.getCreatedAt())
                .reply(review.getReply())
                .repliedAt(review.getRepliedAt())
                .build();
    }
}
