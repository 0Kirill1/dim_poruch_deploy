package dimporuchbe.user.api.dtos;

import lombok.Builder;
import lombok.Data;
import io.swagger.v3.oas.annotations.media.Schema;

@Data
@Builder
public class RegisterResponseDto {
    @Schema(description = "Operation result", example = "Користувача tenant@example.com успішно зареєстровано")
    private String message;
}
