package dimporuchbe.reviews.api.dtos;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import io.swagger.v3.oas.annotations.media.Schema;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Reply text for a review")
public class ReviewReplyRequestDto {
    @NotBlank(message = "Reply message cannot be empty")
    private String reply;
}
