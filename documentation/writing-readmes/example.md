# Example

This is a complete README in the house style. It applies the contract from `structure.md` to the Ledgerly project. The project is a personal finance web application.

````markdown
# Ledgerly

Ledgerly is a personal finance web application for tracking income and expenses. Record transactions and categorise them by type. Review spending with monthly summaries and charts. Set budgets and export transaction data to CSV.

# Features

- Record, edit, and delete income and expense transactions
- Categorise transactions
- View monthly summaries and charts of income and spending
- Set budgets and track spending against them
- Export transaction data to CSV
- Secure sign-in with NextAuth

# Requirements

- Node.js 20 or higher
- PostgreSQL 14 or higher

# Stack

## Frontend

- [Next.js](https://nextjs.org/docs): React framework with the App Router.
- [TypeScript](https://www.typescriptlang.org/): Typed JavaScript.
- [Tailwind CSS](https://tailwindcss.com/docs): Utility-first CSS framework.

## Backend

- [NextAuth](https://next-auth.js.org): Authentication library for Next.js applications.

## Database

- [PostgreSQL](https://www.postgresql.org/): Relational database.
- [Prisma](https://www.prisma.io/docs): ORM and migration tool.

# Setting Up Project

## 1. Clone the Project Locally

Clone the repository and move into the project directory.

```sh
git clone https://github.com/your-name/ledgerly.git
cd ledgerly
```

## 2. Install Dependencies

```sh
npm install
```

## 3. Set Up Environment Variables

Create a `.env` file in the project root with the following values.

```sh
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/ledgerly"
NEXTAUTH_SECRET="<random string>"
NEXTAUTH_URL="http://localhost:3000"
```

- `DATABASE_URL`: Connection string for the PostgreSQL database. Use the credentials of your database user.
- `NEXTAUTH_SECRET`: Secret used to sign session cookies. Generate one with `openssl rand -base64 32`.
- `NEXTAUTH_URL`: Base URL of the application. Required in production.

## 4. Configure the Database

Apply the migrations and generate the Prisma client.

```sh
npx prisma migrate dev
```

This command creates the database tables.

# Run Application

Start the development server.

```sh
npm run dev
```

Alternatively, you can build the whole app and run it using the following commands:

```sh
npm run build
npm start
```

The application should now be running at http://localhost:3000.

# References

- [Next.js documentation](https://nextjs.org/docs) - React framework used for the frontend
- [Prisma documentation](https://www.prisma.io/docs) - ORM and migration tool
- [NextAuth documentation](https://next-auth.js.org) - authentication library
- [Tailwind CSS documentation](https://tailwindcss.com/docs) - CSS framework
- [PostgreSQL documentation](https://www.postgresql.org/docs/) - relational database
````
