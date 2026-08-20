export const TEMPORARY_ACCOUNT_NAMES = [
  "Abigail Jacobo", "Alex", "ANA Yanex", "Angelica Sarabia", "Ariana Duran",
  "Arlene Lazareno", "Avigail Altamirano Chavez", "Baudelia Martinez", "Bridget", "Carmela D",
  "Carmen Verduzco", "cinthia castillo", "Cindy Altamirano", "Claudia Alvarado", "Davy Ranjel",
  "Desly Solano", "Evelyn Ventura", "Faby Lopez", "Fatima Gutierrez", "Gabby Perez",
  "GABRIELA ZARAGOZA", "Giselle Martinez", "Hector Sarabia", "Herminia Valdez", "Jesus",
  "Jessica Garcia", "Jorge Reynosa", "jorg4006", "Layla", "Leah Valenzuela",
  "Leslie Corona", "lluvia padilla", "Maria Ayala", "Maria Garcia", "Maria Martinez",
  "Mariana Castillo Ortiz", "Martha Valencia", "Miguel", "Miley Anguiano", "Monica Cervantes",
  "Rupert", "Samuel G", "socorro estrada", "Sonia Perez", "Victoria Palacios",
  "Yesenia Rodriguez", "Alex Pontilla", "Aaron Vazquez", "Abel Franco", "Alan Ramos",
  "Alejandro Contreras", "Alejandro Ramirez", "Alina Piceno", "Amy Peralta", "Andy Silva",
  "Angel Gutierrez", "Angelina Ponce Pedraza", "Arely Camargo", "Arely Esparza", "Arlene Duran",
  "Ashley Valencia", "Avigail Altamirano", "Axel Martinez", "Bridget Altamirano", "Camila Contreras",
  "Camila Gonzalez Melendrez", "Carlos Estrada", "Christian Martinez", "Clarissa Alvarado", "Dahlia Herrera",
  "Daniel Alcaraz", "Daniela Nicolas", "Dayana Alcala-Botello", "Dayanara Valencia Magana", "Diego Avalos",
  "Dominick Magana", "Doris Ruiz", "Edrick Barrera", "Edwin Perez", "Emily Ranjel",
  "Esbeithy Arreola Perez", "Exain Vargas-Quiroz", "Felipe de Jesus Cervantes", "Gabriela Herrera", "Gabriela Perez",
  "Genesis Corcio", "Gerardo Torres", "Giancarlo Alvarado Quiroz", "Gissele Molina", "Gustavo Vasquez",
  "Hector Garcia", "Israel Llamas- Perez", "Jacquelyn Valencia", "Jakelin Martinez", "Jason Toriz",
  "Jazleen Avalos", "Jenny Valdez", "Jesus Leon", "Jesus Ullola", "Joaquin Castillo",
  "Jose Felix", "Juan Jose Ortiz", "Juan Mendoza", "Julian Valenzuela", "Kelly Valdez",
  "Kenny Valdez", "Leilanni Gutierrez", "Leslie Jolett Hurtado", "Leslie Vazquez", "Luis Soto",
  "Marcos Gudino", "Mariana Castillo", "Miguel Angel Lopez-Navarro", "Miguel Villasenor", "Milena Bermejo",
  "Miranda Martinez", "Misael Arreola", "Monica Guzman", "Monica Sandoval Marquez", "Natalia Soriano",
  "Nazli Cruz Mouge", "Perla Perez", "Priscilla Ramirez", "Prisila Altamirano", "Ricardo Nicolas",
  "Richard Arreola", "Ruben Vasquez", "Rupert Diaz-Cahue", "Salvador Galvan", "Samuel Garduno",
  "Sebastian Ortiz", "Shaira Lopez", "Ulyses Loera Rodriguez", "Ulyses Verdin", "Valeria Alvarez",
  "Valerie Vidal", "Victoria Abigail Palacios", "Victoria Perez", "Vincent Gonzalez", "Viviana Mosqueda",
  "Ximena Guzman", "Yadhira Carrillo", "Yahir Yanez- V.", "Yesmin Aguilera"
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
    fullName: "Test User 3",
    username: "USRTEST3",
    temporaryPassword: "NewTemp3@2026",
    role: "tester"
  }
];
