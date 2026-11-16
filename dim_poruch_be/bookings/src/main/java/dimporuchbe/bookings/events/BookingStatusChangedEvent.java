package dimporuchbe.bookings.events;

import dimporuchbe.bookings.persistence.BookingStatus;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.util.UUID;

@Getter
public class BookingStatusChangedEvent extends ApplicationEvent {
    private final UUID bookingId;
    private final UUID listingId;
    private final UUID tenantId;
    private final UUID landlordId;
    private final BookingStatus oldStatus;
    private final BookingStatus newStatus;

    public BookingStatusChangedEvent(Object source, UUID bookingId, UUID listingId, UUID tenantId, UUID landlordId, BookingStatus oldStatus, BookingStatus newStatus) {
        super(source);
        this.bookingId = bookingId;
        this.listingId = listingId;
        this.tenantId = tenantId;
        this.landlordId = landlordId;
        this.oldStatus = oldStatus;
        this.newStatus = newStatus;
    }
}
