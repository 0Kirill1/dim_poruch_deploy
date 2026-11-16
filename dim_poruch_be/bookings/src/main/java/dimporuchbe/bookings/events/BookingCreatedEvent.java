package dimporuchbe.bookings.events;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.time.LocalDate;
import java.util.UUID;

@Getter
public class BookingCreatedEvent extends ApplicationEvent {
    private final UUID bookingId;
    private final UUID listingId;
    private final UUID landlordId;
    private final UUID tenantId;
    private final LocalDate startDate;
    private final LocalDate endDate;

    public BookingCreatedEvent(Object source, UUID bookingId, UUID listingId, UUID landlordId, UUID tenantId, LocalDate startDate, LocalDate endDate) {
        super(source);
        this.bookingId = bookingId;
        this.listingId = listingId;
        this.landlordId = landlordId;
        this.tenantId = tenantId;
        this.startDate = startDate;
        this.endDate = endDate;
    }
}
