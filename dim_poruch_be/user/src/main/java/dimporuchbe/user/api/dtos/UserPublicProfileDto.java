package dimporuchbe.user.api.dtos;

import dimporuchbe.user.persistence.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserPublicProfileDto {
    @Schema(description = "User identifier", example = "123e4567-e89b-12d3-a456-426614174000")
    private UUID id;
    @Schema(description = "User's full name", example = "Alex Johnson")
    private String fullName;
    @Schema(description = "Assigned account role", example = "TENANT")
    private Role role;
    @Schema(description = "Date and time the user joined", example = "2024-01-15T10:30:00+00:00")
    private OffsetDateTime memberSince;
}
