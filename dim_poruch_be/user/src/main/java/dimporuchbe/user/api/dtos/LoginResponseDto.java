package dimporuchbe.user.api.dtos;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import io.swagger.v3.oas.annotations.media.Schema;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginResponseDto {
    @Schema(description = "Operation result", example = "Користувач tenant@example.com успішно увійшов!")
    private String message;
    @Schema(description = "JWT access token", accessMode = Schema.AccessMode.READ_ONLY, format = "password")
    private String jwt_token;
    @Schema(description = "JWT refresh token", accessMode = Schema.AccessMode.READ_ONLY, format = "password")
    private String refresh_token;
}
