package dimporuchbe.user.api.dtos;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import io.swagger.v3.oas.annotations.media.Schema;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class LoginRequestDto {
    @Schema(description = "User email address", example = "tenant@example.com")
    private String email;
    @Schema(description = "Account password", example = "securePass123", format = "password", accessMode = Schema.AccessMode.WRITE_ONLY)
    private String password;
}
