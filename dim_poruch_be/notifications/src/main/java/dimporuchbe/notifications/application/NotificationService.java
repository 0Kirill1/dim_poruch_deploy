package dimporuchbe.notifications.application;

import dimporuchbe.notifications.api.dtos.NotificationDto;
import dimporuchbe.notifications.persistence.Notification;
import dimporuchbe.notifications.persistence.NotificationRepository;
import dimporuchbe.notifications.persistence.NotificationType;
import dimporuchbe.user.persistence.User;
import dimporuchbe.user.persistence.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotificationService {
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<NotificationDto> getUserNotification(String email){
        User user = userRepository.findByEmail(email).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        List<Notification> notifications = notificationRepository.findAllByRecipientOrderByCreatedAtDesc(user.getId());
        return notifications.stream().map(this::mapToDto).toList();
    }

    @Transactional(readOnly = true)
    public Long getUnreadCount(String email){
        User user = userRepository.findByEmail(email).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        return notificationRepository.countByRecipientAndReadAtIsNull(user.getId());
    }

    @Transactional
    public NotificationDto markAsRead(UUID id, String email){
        User user = userRepository.findByEmail(email).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Notification notification = notificationRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found"));

        if(!notification.getRecipient().equals(user.getId())){
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Notification does not belong to this user");
        }

        notification.setReadAt(OffsetDateTime.now());
        Notification saved = notificationRepository.save(notification);
        return mapToDto(saved);
    }

    @Transactional
    public void markAllAsRead(String email){
        User user = userRepository.findByEmail(email).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        notificationRepository.markAllAsRead(user.getId());
    }

    @Transactional
    public Notification sendNotification(UUID recipientId, NotificationType type, String title, String body){
        Notification notification = Notification.builder()
                .recipient(recipientId)
                .type(type)
                .title(title)
                .body(body)
                .createdAt(OffsetDateTime.now())
                .build();

        return notificationRepository.save(notification);
    }

    private NotificationDto mapToDto(Notification notification){
        return NotificationDto.builder()
                .id(notification.getId())
                .recipient(notification.getRecipient())
                .type(notification.getType().name())
                .title(notification.getTitle())
                .body(notification.getBody())
                .readAt(notification.getReadAt())
                .createdAt(notification.getCreatedAt())
                .build();
    }
}
