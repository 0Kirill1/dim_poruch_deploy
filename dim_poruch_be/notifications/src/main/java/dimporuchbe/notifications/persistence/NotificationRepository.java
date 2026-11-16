package dimporuchbe.notifications.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {
    List<Notification> findAllByRecipientOrderByCreatedAtDesc(UUID recipient);

    Long countByRecipientAndReadAtIsNull(UUID recipient);

    @Modifying
    @Query("UPDATE Notification n SET n.readAt = CURRENT_TIMESTAMP WHERE n.recipient = :recipient AND n.readAt IS NULL")
    void markAllAsRead(@Param("recipient") UUID recipient);
}
