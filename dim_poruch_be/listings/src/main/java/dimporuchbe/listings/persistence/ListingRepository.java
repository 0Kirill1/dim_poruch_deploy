package dimporuchbe.listings.persistence;

import dimporuchbe.user.persistence.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ListingRepository extends JpaRepository<Listing, UUID>, JpaSpecificationExecutor<Listing> {
    @Query("SELECT l.id FROM Listing l WHERE l.owner = :owner")
    List<UUID> findIdsByOwnerId(@Param("owner") User owner);

    Page<Listing> findByOwner(User owner, Pageable pageable);

    Page<Listing> findByStatus(Status status, Pageable pageable);

    Long countByStatus(Status status);
}
