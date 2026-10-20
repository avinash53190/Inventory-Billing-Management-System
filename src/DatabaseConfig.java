import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public final class DatabaseConfig {
    private static final String URL = "jdbc:mysql://localhost:3306/inventory_db?serverTimezone=UTC";
    private static final String USER = "root";
    private static String password;

    private DatabaseConfig() {
    }

    public static void configurePassword(String value) {
        password = value;
    }

    public static Connection openConnection() throws SQLException {
        if (password == null) {
            throw new SQLException("Database password has not been configured");
        }
        return openConnection(password);
    }

    public static Connection openConnection(String password) throws SQLException {
        return DriverManager.getConnection(URL, USER, password);
    }

    public static void testConnection(String password) throws SQLException {
        try (Connection connection = openConnection(password)) {
            System.out.println("CONNECTION SUCCESSFUL");
        }
    }
}