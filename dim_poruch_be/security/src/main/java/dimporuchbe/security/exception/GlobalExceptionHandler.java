package dimporuchbe.security.exception;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> handleResponseStatusException(ResponseStatusException exception){
        ErrorResponse error = new ErrorResponse(
                exception.getStatusCode().value(),
                exception.getReason(),
                OffsetDateTime.now()
        );

        return new ResponseEntity<>(error, exception.getStatusCode());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ValidationErrorResponse> handleValidationError(MethodArgumentNotValidException exception){
        Map<String, String> errors = new HashMap<>();

        exception.getBindingResult().getFieldErrors().forEach(error ->
                errors.put(error.getField(), error.getDefaultMessage())
        );

        ValidationErrorResponse error = new ValidationErrorResponse(
                OffsetDateTime.now(),
                400,
                errors
        );

        return new ResponseEntity<>(error, exception.getStatusCode());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleAllExceptions(Exception exception){
        ErrorResponse error = new ErrorResponse(
                500,
                "Internal Server Error: " + exception.getMessage(),
                OffsetDateTime.now()
        );

        return ResponseEntity.internalServerError().body(error);
    }
}
