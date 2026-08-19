export const TEMPORARY_ACCOUNT_NAMES = [
  "Abigail Jacobo", "Alex", "ANA Yanex", "Angelica Sarabia", "Ariana Duran",
  "Arlene Lazareno", "Avigail Altamirano Chavez", "Baudelia Martinez", "Bridget",
  "Carmela D", "Carmen Verduzco", "cinthia castillo", "Cindy Altamirano",
  "Claudia Alvarado", "Davy Ranjel", "Desly Solano", "Evelyn Ventura",
  "Faby Lopez", "Fatima Gutierrez", "Gabby Perez", "GABRIELA ZARAGOZA",
  "Giselle Martinez", "Hector Sarabia", "Herminia Valdez", "Jesus",
  "Jessica Garcia", "Jorge Reynosa", "jorg4006", "Layla", "Leah Valenzuela",
  "Leslie Corona", "lluvia padilla", "Maria Ayala", "Maria Garcia",
  "Maria Martinez", "Mariana Castillo Ortiz", "Martha Valencia", "Miguel",
  "Miley Anguiano", "Monica Cervantes", "Rupert", "Samuel G", "socorro estrada",
  "Sonia Perez", "Victoria Palacios", "Yesenia Rodriguez", "Alex Pontilla"
];

export const TEMPORARY_ACCOUNTS = [
  ...TEMPORARY_ACCOUNT_NAMES.map((fullName, index) => {
    const code = String(index + 1).padStart(3, "0");

    return {
      fullName,
      username: `USR${code}`,
      temporaryPassword: `Serve@${code}`,
      role: "user"
    };
  }),

  {
    fullName: "Test User 1",
    username: "USRTEST1",
    temporaryPassword: "NewTemp1@2026",
    role: "tester"
  },

  {
    fullName: "Test User 2",
    username: "USRTEST2",
    temporaryPassword: "NewTemp2@2026",
    role: "tester"
  },

  {
    fullName: "Saintagram Replacement Test User",
    username: "USRTEST3",
    temporaryPassword: "NewTemp3@2026",
    role: "tester"
  }
];
