package dimporuchbe.notifications.api.controllers;

import dimporuchbe.notifications.api.dtos.NotificationDto;
import dimporuchbe.notifications.application.NotificationService;
import lombok.RequiredArgsConstructor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/me/notifications")
@Tag(name = "Notifications", description = "Authenticated user notifications")
@SecurityRequirement(name = "bearerAuth")
public class NotificationsController {
    private final NotificationService notificationService;

    @GetMapping
    @Operation(summary = "List my notifications")
    public ResponseEntity<List<NotificationDto>> getUserNotifications(@AuthenticationPrincipal UserDetails userDetails){
        String email = userDetails.getUsername();
        List<NotificationDto> result = notificationService.getUserNotification(email);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/unread-count")
    @Operation(summary = "Get unread notification count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(@AuthenticationPrincipal UserDetails userDetails){
        String email = userDetails.getUsername();
        Long count = notificationService.getUnreadCount(email);
        return ResponseEntity.ok(Map.of("unreadCount", count));
    }

    @PatchMapping("/{id}/read")
    @Operation(summary = "Mark a notification as read")
    public ResponseEntity<NotificationDto> markAsRead(@PathVariable UUID id,
                                                      @AuthenticationPrincipal UserDetails userDetails){
        String email = userDetails.getUsername();
        NotificationDto result = notificationService.markAsRead(id, email);
        return ResponseEntity.ok(result);
    }

    @PatchMapping("/read-all")
    @Operation(summary = "Mark all notifications as read")
    public ResponseEntity<Map<String, String>> markAllAsRead(@AuthenticationPrincipal UserDetails userDetails){
        String email = userDetails.getUsername();
        notificationService.markAllAsRead(email);
        return ResponseEntity.ok(Map.of("message", "Усі сповіщення позначено як прочитані"));
    }
}
