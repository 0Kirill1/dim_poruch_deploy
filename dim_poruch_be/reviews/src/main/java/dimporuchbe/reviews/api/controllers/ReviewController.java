package dimporuchbe.reviews.api.controllers;

import dimporuchbe.reviews.api.dtos.CreateReviewDto;
import dimporuchbe.reviews.api.dtos.ReviewDto;
import dimporuchbe.reviews.application.ReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/bookings/{id}/review")
@Tag(name = "Reviews", description = "Booking reviews")
public class ReviewController {
    private final ReviewService reviewService;

    @PostMapping()
    @Operation(summary = "Create a booking review")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ReviewDto> createReview(@PathVariable("id") UUID booking,
                                                  @RequestBody @Valid CreateReviewDto dto,
                                                  @AuthenticationPrincipal UserDetails userDetails){
        String email = userDetails.getUsername();
        ReviewDto result = reviewService.createReview(dto, booking, email);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @GetMapping
    @Operation(summary = "List booking reviews")
    public ResponseEntity<List<ReviewDto>> getReviews(@PathVariable("id") UUID booking){
        List<ReviewDto> result = reviewService.getBookingReviews(booking);
        return ResponseEntity.ok(result);
    }
}
