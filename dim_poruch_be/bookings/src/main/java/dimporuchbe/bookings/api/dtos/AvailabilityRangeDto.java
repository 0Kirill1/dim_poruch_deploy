package dimporuchbe.bookings.api.dtos;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Unavailable date range for a listing")
public class AvailabilityRangeDto {
    private LocalDate startDate;
    private LocalDate endDate;
}
