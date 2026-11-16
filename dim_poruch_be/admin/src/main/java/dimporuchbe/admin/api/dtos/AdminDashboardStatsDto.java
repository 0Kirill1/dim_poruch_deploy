package dimporuchbe.admin.api.dtos;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import io.swagger.v3.oas.annotations.media.Schema;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Aggregated platform statistics for administrators")
public class AdminDashboardStatsDto {
    private Long totalUsers;
    private Long totalLandlords;
    private Long totalTenants;
    private Long blockedUsers;

    private Long totalListings;
    private Long activeListings;
    private Long pendingListings;

    private Long totalReviews;
    private Long pendingReviews;
}
