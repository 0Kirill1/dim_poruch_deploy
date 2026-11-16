package dimporuchbe.notifications.api.dtos;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Schema(description = "User notification")
public class NotificationDto {
    private UUID id;
    private UUID recipient;
    private String status;
    private String type;
    private String title;
    private String body;
    private OffsetDateTime readAt;
    private OffsetDateTime createdAt;
}
