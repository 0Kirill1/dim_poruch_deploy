package dimporuchbe.user.api.dtos;

import dimporuchbe.user.persistence.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileDto {

    @Schema(description = "User identifier", accessMode = Schema.AccessMode.READ_ONLY, example = "123e4567-e89b-12d3-a456-426614174000")
    private UUID id;

    @Email(message = "Invalid email format")
    @Schema(description = "User email address", example = "tenant@example.com")
    private String email;

    @Size(max = 120, message = "Full name cannot exceed 120 characters")
    @Schema(description = "User's full name", example = "Alex Johnson", maxLength = 120)
    private String fullName;

    @Pattern(regexp = "^\\+?[0-9. ()-]{7,25}$", message = "Invalid phone number format")
    @Schema(description = "Contact phone number", example = "+1 555 123 4567")
    private String phone;

    @Schema(description = "Assigned account role", accessMode = Schema.AccessMode.READ_ONLY, example = "TENANT")
    private Role role;
}
