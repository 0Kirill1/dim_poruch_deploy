package dimporuchbe.reviews.api.controllers;

import dimporuchbe.reviews.api.dtos.ListingRatingDto;
import dimporuchbe.reviews.api.dtos.ReviewDto;
import dimporuchbe.reviews.application.ReviewService;
import lombok.RequiredArgsConstructor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/listings")
@RequiredArgsConstructor
@Tag(name = "Reviews", description = "Listing reviews and ratings")
public class ListingsReviewController {

    private final ReviewService reviewService;

    @GetMapping("/{id}/reviews")
    @Operation(summary = "List reviews for a listing")
    public ResponseEntity<Page<ReviewDto>> getListingReviews(@PathVariable UUID id, Pageable pageable) {
        return ResponseEntity.ok(reviewService.getListingReviews(id, pageable));
    }

    @GetMapping("/{id}/rating")
    @Operation(summary = "Get a listing rating")
    public ResponseEntity<ListingRatingDto> getListingRating(@PathVariable UUID id) {
        return ResponseEntity.ok(reviewService.getListingRating(id));
    }
}
