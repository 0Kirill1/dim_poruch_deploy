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
public class LogoutResponseDto {
    @Schema(description = "Operation result", example = "Ви успішно вийшли із системи")
    private String message;
}
