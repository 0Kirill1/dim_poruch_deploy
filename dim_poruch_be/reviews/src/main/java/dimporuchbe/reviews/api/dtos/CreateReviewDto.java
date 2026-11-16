package dimporuchbe.reviews.api.dtos;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;
import io.swagger.v3.oas.annotations.media.Schema;

@Data
@Schema(description = "Data required to create a review")
public class CreateReviewDto {
    @Min(1)
    @Max(5)
    @Schema(description = "Rating from 1 to 5", example = "5", minimum = "1", maximum = "5")
    private Short rating;

    private String comment;
}
