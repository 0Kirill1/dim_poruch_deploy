package dimporuchbe.notifications.application;

import dimporuchbe.bookings.events.BookingCreatedEvent;
import dimporuchbe.bookings.events.BookingStatusChangedEvent;
import dimporuchbe.bookings.persistence.BookingStatus;
import dimporuchbe.notifications.persistence.NotificationType;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class NotificationEventListener {

    private final NotificationService notificationService;

    @EventListener
    public void handleBookingCreated(BookingCreatedEvent event) {
        notificationService.sendNotification(
                event.getLandlordId(),
                NotificationType.BOOKING_CREATED,
                "Новий запит на бронювання",
                "Ви отримали новий запит на бронювання на дати: " + event.getStartDate() + " до " + event.getEndDate()
        );
    }

    @EventListener
    public void handleBookingStatusChanged(BookingStatusChangedEvent event) {
        Map<BookingStatus, String> statusTranslated = new HashMap<>();
        statusTranslated.put(BookingStatus.APPROVED, "Підтверджено");
        statusTranslated.put(BookingStatus.REJECTED, "Відхилено");
        statusTranslated.put(BookingStatus.COMPLETED, "Завершено");
        statusTranslated.put(BookingStatus.CANCELLED, "Скасовано");

        notificationService.sendNotification(
                event.getTenantId(),
                NotificationType.BOOKING_STATUS_CHANGED,
                "Зміна статусу бронювання",
                "Статус вашого бронювання було змінено на: " + statusTranslated.get(event.getNewStatus())
        );
    }
}
