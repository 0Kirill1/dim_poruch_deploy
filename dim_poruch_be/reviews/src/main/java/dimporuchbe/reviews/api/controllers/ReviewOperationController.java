package dimporuchbe.reviews.api.controllers;

import dimporuchbe.reviews.api.dtos.ReviewDto;
import dimporuchbe.reviews.api.dtos.ReviewReplyRequestDto;
import dimporuchbe.reviews.application.ReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/reviews")
@RequiredArgsConstructor
@Tag(name = "Reviews", description = "Review operations")
@SecurityRequirement(name = "bearerAuth")
public class ReviewOperationController {

    private final ReviewService reviewService;

    @PreAuthorize("hasRole('LANDLORD')")
    @PostMapping("/{id}/reply")
    @Operation(summary = "Reply to a review")
    public ResponseEntity<ReviewDto> replyToReview(@PathVariable UUID id,
                                                   @RequestBody @Valid ReviewReplyRequestDto dto,
                                                   @AuthenticationPrincipal UserDetails userDetails) {
        ReviewDto result = reviewService.replyToReview(id, dto, userDetails.getUsername());
        return ResponseEntity.ok(result);
    }
}
