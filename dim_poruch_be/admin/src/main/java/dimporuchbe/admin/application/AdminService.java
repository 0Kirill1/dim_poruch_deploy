package dimporuchbe.admin.application;

import dimporuchbe.admin.api.dtos.AdminDashboardStatsDto;
import dimporuchbe.listings.api.dtos.ListingDto;
import dimporuchbe.listings.persistence.Listing;
import dimporuchbe.listings.persistence.ListingRepository;
import dimporuchbe.listings.persistence.Status;
import dimporuchbe.reviews.api.dtos.ReviewDto;
import dimporuchbe.reviews.persistence.Review;
import dimporuchbe.reviews.persistence.ReviewRepository;
import dimporuchbe.reviews.persistence.ReviewStatus;
import dimporuchbe.user.api.dtos.UserProfileDto;
import dimporuchbe.user.persistence.Role;
import dimporuchbe.user.persistence.User;
import dimporuchbe.user.persistence.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminService {
    private final ListingRepository listingRepository;
    private final UserRepository userRepository;
    private final ReviewRepository reviewRepository;

    @Transactional
    public ListingDto updateListingStatus(UUID id, Status status){
        Listing listing = listingRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found"));

        listing.setStatus(status);
        Listing saved = listingRepository.save(listing);

        return mapListingToDto(saved);
    }

    @Transactional
    public UserProfileDto updateUserStatus(UUID id, String status){
        User user = userRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        user.setStatus(status);
        User saved = userRepository.save(user);

        return mapUserToDto(saved);
    }

    @Transactional
    public UserProfileDto unblockUser(UUID id){
        return updateUserStatus(id, "ACTIVE");
    }

    @Transactional
    public ReviewDto updateReviewStatus(UUID id, ReviewStatus status){
        Review review = reviewRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found"));

        review.setStatus(status);
        Review saved = reviewRepository.save(review);

        return mapReviewToDto(saved);
    }

    @Transactional(readOnly = true)
    public Page<ListingDto> getPendingListings(Pageable pageable){
        return listingRepository.findByStatus(Status.MODERATION, pageable).map(this::mapListingToDto);
    }

    @Transactional(readOnly = true)
    public Page<ReviewDto> getPendingReviews(Pageable pageable){
        return reviewRepository.findByStatus(ReviewStatus.PENDING, pageable).map(this::mapReviewToDto);
    }

    @Transactional(readOnly = true)
    public Page<UserProfileDto> getUsers(String status, Role role, Pageable pageable){
        Page<User> users;
        if(status != null && !status.isBlank()){
            users = userRepository.findByStatus(status, pageable);
        } else if(role != null){
            users = userRepository.findByRole(role, pageable);
        } else {
            users = userRepository.findAll(pageable);
        }
        return users.map(this::mapUserToDto);
    }

    @Transactional(readOnly = true)
    public AdminDashboardStatsDto getDashboardStats(){
        Long totalUsers = userRepository.count();
        Long totalLandlords = userRepository.countByRole(Role.LANDLORD);
        Long totalTenants = userRepository.countByRole(Role.TENANT);
        Long blockedUsers = userRepository.countByStatus("BLOCKED");

        Long totalListings = listingRepository.count();
        Long activeListings = listingRepository.countByStatus(Status.ACTIVE);
        Long pendingListings = listingRepository.countByStatus(Status.MODERATION);

        Long totalReviews = reviewRepository.count();
        Long pendingReviews = reviewRepository.countByStatus(ReviewStatus.PENDING);

        return AdminDashboardStatsDto.builder()
                .totalUsers(totalUsers)
                .totalLandlords(totalLandlords)
                .totalTenants(totalTenants)
                .blockedUsers(blockedUsers)
                .totalListings(totalListings)
                .activeListings(activeListings)
                .pendingListings(pendingListings)
                .totalReviews(totalReviews)
                .pendingReviews(pendingReviews)
                .build();
    }

    private ListingDto mapListingToDto(Listing listing){
        return ListingDto.builder()
                .id(listing.getId())
                .title(listing.getTitle())
                .description(listing.getDescription())
                .city(listing.getCity())
                .address(listing.getAddress())
                .monthlyPrice(listing.getMonthlyPrice())
                .rooms(listing.getRooms())
                .area(listing.getArea())
                .propertyType(listing.getPropertyType() != null ? listing.getPropertyType().name() : null)
                .status(listing.getStatus() != null ? listing.getStatus().name() : null)
                .ownerId(listing.getOwner() != null ? listing.getOwner().getId() : null)
                .build();
    }

    private UserProfileDto mapUserToDto(User user){
        return UserProfileDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .role(user.getRole())
                .build();
    }

    private ReviewDto mapReviewToDto(Review review){
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
