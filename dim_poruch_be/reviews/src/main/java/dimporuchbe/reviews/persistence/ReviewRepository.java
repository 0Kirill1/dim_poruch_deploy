package dimporuchbe.reviews.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ReviewRepository extends JpaRepository<Review, UUID> {
    boolean existsByAuthorAndBooking(UUID author, UUID booking);

    List<Review> findByBooking(UUID booking);

    Page<Review> findByStatus(ReviewStatus status, Pageable pageable);

    Long countByStatus(ReviewStatus status);

    @Query("SELECT r FROM Review r, Booking b WHERE r.booking = b.id AND b.listing = :listingId AND r.status = :status ORDER BY r.createdAt DESC")
    Page<Review> findByListingIdAndStatus(@Param("listingId") UUID listingId, @Param("status") ReviewStatus status, Pageable pageable);

    @Query("SELECT AVG(CAST(r.rating as double)) FROM Review r, Booking b WHERE r.booking = b.id AND b.listing = :listingId AND r.status = 'APPROVED'")
    Double getAverageRatingForListing(@Param("listingId") UUID listingId);

    @Query("SELECT COUNT(r) FROM Review r, Booking b WHERE r.booking = b.id AND b.listing = :listingId AND r.status = 'APPROVED'")
    Long getReviewCountForListing(@Param("listingId") UUID listingId);
}
