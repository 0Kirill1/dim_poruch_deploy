package dimporuchbe.dim_poruch_be;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(scanBasePackages = "dimporuchbe")
@EnableJpaRepositories(basePackages = "dimporuchbe")
@EntityScan(basePackages = "dimporuchbe")
@EnableScheduling
public class DimPoruchBeApplication {

	public static void main(String[] args) {
		SpringApplication.run(DimPoruchBeApplication.class, args);
	}

}
