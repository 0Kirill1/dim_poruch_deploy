package dimporuchbe.security.exception;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.Map;

@Data
@AllArgsConstructor
public class ValidationErrorResponse {
    private OffsetDateTime timestamp;
    private int status;
    private Map<String, String> errors;
}
