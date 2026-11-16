package dimporuchbe.admin.api.controllers;

import dimporuchbe.admin.api.dtos.AdminDashboardStatsDto;
import dimporuchbe.admin.application.AdminService;
import dimporuchbe.listings.api.dtos.ListingDto;
import dimporuchbe.listings.persistence.Status;
import dimporuchbe.reviews.api.dtos.ReviewDto;
import dimporuchbe.reviews.persistence.ReviewStatus;
import dimporuchbe.user.api.dtos.UserProfileDto;
import dimporuchbe.user.persistence.Role;
import lombok.RequiredArgsConstructor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Administration", description = "Administrative moderation and account management")
@SecurityRequirement(name = "bearerAuth")
public class AdminController {
    private final AdminService adminService;

    @GetMapping("/listings/pending")
    @Operation(summary = "List listings pending moderation")
    @ApiResponse(responseCode = "200", description = "Pending listings returned")
    public ResponseEntity<Page<ListingDto>> getPendingListings(Pageable pageable){
        Page<ListingDto> result = adminService.getPendingListings(pageable);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/listings/{id}/approve")
    @Operation(summary = "Approve a listing")
    @ApiResponses({@ApiResponse(responseCode = "200", description = "Listing approved"),
            @ApiResponse(responseCode = "404", description = "Listing not found")})
    public ResponseEntity<ListingDto> approveListing(@PathVariable UUID id){
        ListingDto result = adminService.updateListingStatus(id, Status.ACTIVE);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/listings/{id}/reject")
    @Operation(summary = "Reject a listing")
    @ApiResponses({@ApiResponse(responseCode = "200", description = "Listing rejected"),
            @ApiResponse(responseCode = "404", description = "Listing not found")})
    public ResponseEntity<ListingDto> rejectListing(@PathVariable UUID id){
        ListingDto result = adminService.updateListingStatus(id, Status.REJECTED);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/reviews/pending")
    @Operation(summary = "List reviews pending moderation")
    @ApiResponse(responseCode = "200", description = "Pending reviews returned")
    public ResponseEntity<Page<ReviewDto>> getPendingReviews(Pageable pageable){
        Page<ReviewDto> result = adminService.getPendingReviews(pageable);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/reviews/{id}/approve")
    @Operation(summary = "Approve a review")
    @ApiResponses({@ApiResponse(responseCode = "200", description = "Review approved"),
            @ApiResponse(responseCode = "404", description = "Review not found")})
    public ResponseEntity<ReviewDto> approveReview(@PathVariable UUID id){
        ReviewDto result = adminService.updateReviewStatus(id, ReviewStatus.APPROVED);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/reviews/{id}/reject")
    @Operation(summary = "Reject a review")
    @ApiResponses({@ApiResponse(responseCode = "200", description = "Review rejected"),
            @ApiResponse(responseCode = "404", description = "Review not found")})
    public ResponseEntity<ReviewDto> rejectReview(@PathVariable UUID id){
        ReviewDto result = adminService.updateReviewStatus(id, ReviewStatus.REJECTED);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/users")
    @Operation(summary = "Search users")
    @ApiResponse(responseCode = "200", description = "Users returned")
    public ResponseEntity<Page<UserProfileDto>> getUsers(@RequestParam(required = false) String status,
                                                         @RequestParam(required = false) Role role,
                                                         Pageable pageable){
        Page<UserProfileDto> result = adminService.getUsers(status, role, pageable);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/users/{id}/block")
    @Operation(summary = "Block a user")
    public ResponseEntity<UserProfileDto> blockUser(@PathVariable UUID id){
        UserProfileDto result = adminService.updateUserStatus(id, "BLOCKED");
        return ResponseEntity.ok(result);
    }

    @PostMapping("/users/{id}/unblock")
    @Operation(summary = "Unblock a user")
    public ResponseEntity<UserProfileDto> unblockUser(@PathVariable UUID id){
        UserProfileDto result = adminService.unblockUser(id);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/dashboard/stats")
    @Operation(summary = "Get dashboard statistics")
    @ApiResponse(responseCode = "200", description = "Dashboard statistics returned")
    public ResponseEntity<AdminDashboardStatsDto> getDashboardStats(){
        AdminDashboardStatsDto result = adminService.getDashboardStats();
        return ResponseEntity.ok(result);
    }
}
