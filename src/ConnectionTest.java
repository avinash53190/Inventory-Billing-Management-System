public class ConnectionTest {
    public static void main(String[] args) {
        try {
            System.out.print("Enter MySQL root password: ");
            System.out.flush();
            java.util.Scanner scanner = new java.util.Scanner(System.in);
            DatabaseConfig.testConnection(scanner.nextLine());
        } catch (Exception exception) {
            System.err.println("CONNECTION FAILED: " + exception.getMessage());
            System.exit(1);
        }
    }
}