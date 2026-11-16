package dimporuchbe.bookings.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface BookingRepository extends JpaRepository<Booking, UUID> {

    @Query("SELECT COUNT(b) > 0 FROM Booking b " +
            "WHERE b.listing = :listingId " +
            "AND b.status IN ('APPROVED', 'ACTIVE') " +
            "AND b.startDate < :endDate AND b.endDate > :startDate")
    boolean existsOverLappingBooking(
            @Param("listingId") UUID listingId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );

    @Query("FROM Booking b WHERE b.tenant = :tenantId")
    List<Booking> findAllByTenantId(@Param("tenantId") UUID tenantId);

    @Query("SELECT b FROM Booking b " +
            "WHERE b.listing IN :listingIds " +
            "AND (:status IS NULL OR b.status = :status)")
    Page<Booking> findByListingIdsAndOptionalStatus(
            @Param("listingIds") List<UUID> listingIds,
            @Param("status") BookingStatus status,
            Pageable pageable
    );

    @Query("SELECT b FROM Booking b " +
            "WHERE b.listing = :listingId " +
            "AND b.status IN ('APPROVED', 'ACTIVE') " +
            "AND b.endDate >= :today " +
            "ORDER BY b.startDate ASC")
    List<Booking> findFutureBookingsForListing(
            @Param("listingId") UUID listingId,
            @Param("today") LocalDate today
    );

    @Query("SELECT b FROM Booking b WHERE b.status = 'APPROVED' AND b.startDate <= CURRENT_DATE")
    List<Booking> findBookingsToActivate();
}
