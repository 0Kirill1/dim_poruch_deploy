package dimporuchbe.reviews.api.dtos;

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
@Schema(description = "Booking review")
public class ReviewDto {
    private UUID id;
    private UUID booking;
    private UUID author;
    private Short rating;
    private String comment;
    private String status;
    private OffsetDateTime createdAt;
    private String reply;
    private OffsetDateTime repliedAt;
}
