// Lieux réels de Mouriès (OpenStreetMap, 14/07/2026)
const PLACES = [
 {
  "id": "n401881581",
  "name": "Mas du Gourgonnier",
  "cat": "artisanat",
  "sub": "wine",
  "lat": 43.723466,
  "lon": 4.885734,
  "price": 72500
 },
 {
  "id": "n2800383750",
  "name": "Mouries",
  "cat": "commerce",
  "sub": "post_office",
  "lat": 43.689023,
  "lon": 4.871856,
  "price": 36000
 },
 {
  "id": "n5120402722",
  "name": "Moulin à Huile Coopérative",
  "cat": "artisanat",
  "sub": "attraction",
  "lat": 43.687187,
  "lon": 4.87819,
  "price": 76000
 },
 {
  "id": "n5247655805",
  "name": "Oppidum des Caisses de Jean-Jean",
  "cat": "culture",
  "sub": "archaeological_site",
  "lat": 43.71136,
  "lon": 4.880024,
  "price": 77500
 },
 {
  "id": "n5649457801",
  "name": "Le Fournil de Mouriès",
  "cat": "boulangerie",
  "sub": "bakery",
  "lat": 43.687848,
  "lon": 4.875519,
  "price": 25000
 },
 {
  "id": "n6861156271",
  "name": "Provence Matériaux",
  "cat": "commerce",
  "sub": "doityourself",
  "lat": 43.686554,
  "lon": 4.8646,
  "price": 63000
 },
 {
  "id": "n10746460364",
  "name": "Domaine de Lauzières",
  "cat": "artisanat",
  "sub": "winery",
  "lat": 43.716232,
  "lon": 4.914861,
  "price": 67500
 },
 {
  "id": "n10814865197",
  "name": "Laura coiffure",
  "cat": "commerce",
  "sub": "hairdresser",
  "lat": 43.689858,
  "lon": 4.870675,
  "price": 25000
 },
 {
  "id": "n10814865982",
  "name": "Marine esthétique",
  "cat": "commerce",
  "sub": "beauty",
  "lat": 43.689775,
  "lon": 4.870981,
  "price": 26000
 },
 {
  "id": "n10814878352",
  "name": "Jeanne",
  "cat": "commerce",
  "sub": "hairdresser",
  "lat": 43.689688,
  "lon": 4.870993,
  "price": 22000
 },
 {
  "id": "n10814887769",
  "name": "Le Commerce",
  "cat": "restaurant",
  "sub": "restaurant",
  "lat": 43.689706,
  "lon": 4.870747,
  "price": 47000
 },
 {
  "id": "n10814889810",
  "name": "Le fournil des Alpilles",
  "cat": "boulangerie",
  "sub": "bakery",
  "lat": 43.690418,
  "lon": 4.867419,
  "price": 28000
 },
 {
  "id": "n10814890476",
  "name": "Boucherie Michel",
  "cat": "commerce",
  "sub": "butcher",
  "lat": 43.689579,
  "lon": 4.871085,
  "price": 41000
 },
 {
  "id": "n10814895337",
  "name": "Moulin Saint-Michel",
  "cat": "artisanat",
  "sub": "farm",
  "lat": 43.690147,
  "lon": 4.870952,
  "price": 59000
 },
 {
  "id": "n10814896566",
  "name": "Le Grand Café du Cours",
  "cat": "bar",
  "sub": "bar",
  "lat": 43.689498,
  "lon": 4.871128,
  "price": 26500
 },
 {
  "id": "n10814896870",
  "name": "La casa de Pizza",
  "cat": "restaurant",
  "sub": "restaurant",
  "lat": 43.689152,
  "lon": 4.871347,
  "price": 50500
 },
 {
  "id": "n10814898196",
  "name": "Médiathèque La Regalido",
  "cat": "culture",
  "sub": "library",
  "lat": 43.688755,
  "lon": 4.871479,
  "price": 41000
 },
 {
  "id": "n10814900240",
  "name": "Tagliatelle",
  "cat": "commerce",
  "sub": "convenience",
  "lat": 43.689752,
  "lon": 4.870722,
  "price": 55000
 },
 {
  "id": "n10814928963",
  "name": "L'Opticien",
  "cat": "commerce",
  "sub": "optician",
  "lat": 43.689299,
  "lon": 4.870909,
  "price": 36000
 },
 {
  "id": "n10814928964",
  "name": "Pharmacie de la Vallée des Baux",
  "cat": "commerce",
  "sub": "pharmacy",
  "lat": 43.689197,
  "lon": 4.870935,
  "price": 92000
 },
 {
  "id": "n10815000266",
  "name": "17 le coiffeur",
  "cat": "commerce",
  "sub": "hairdresser",
  "lat": 43.688963,
  "lon": 4.872089,
  "price": 25000
 },
 {
  "id": "n10815012576",
  "name": "Song Long",
  "cat": "restaurant",
  "sub": "restaurant",
  "lat": 43.689038,
  "lon": 4.871784,
  "price": 57500
 },
 {
  "id": "n10815013058",
  "name": "Caisse d'Épargne",
  "cat": "commerce",
  "sub": "bank",
  "lat": 43.688982,
  "lon": 4.872008,
  "price": 79000
 },
 {
  "id": "n10815017729",
  "name": "Café de l'avenir",
  "cat": "cafe",
  "sub": "cafe",
  "lat": 43.689374,
  "lon": 4.87088,
  "price": 31500
 },
 {
  "id": "n10815023319",
  "name": "Le Cyrano",
  "cat": "commerce",
  "sub": "newsagent",
  "lat": 43.689451,
  "lon": 4.870838,
  "price": 32000
 },
 {
  "id": "n10815024409",
  "name": "Le jardin de Mai Ly",
  "cat": "commerce",
  "sub": "florist",
  "lat": 43.689051,
  "lon": 4.871717,
  "price": 25000
 },
 {
  "id": "n10815031890",
  "name": "Café de Provence",
  "cat": "cafe",
  "sub": "cafe",
  "lat": 43.689504,
  "lon": 4.87083,
  "price": 35000
 },
 {
  "id": "n10815032127",
  "name": "Mas de la Tapi",
  "cat": "artisanat",
  "sub": "farm",
  "lat": 43.689562,
  "lon": 4.87081,
  "price": 61000
 },
 {
  "id": "n12242098393",
  "name": "La Casita",
  "cat": "commerce",
  "sub": "clothes",
  "lat": 43.689136,
  "lon": 4.87141,
  "price": 31500
 },
 {
  "id": "n12927766001",
  "name": "Wash.me",
  "cat": "commerce",
  "sub": "laundry",
  "lat": 43.69119,
  "lon": 4.864329,
  "price": 22000
 },
 {
  "id": "n13116887067",
  "name": "Utile",
  "cat": "commerce",
  "sub": "convenience",
  "lat": 43.690579,
  "lon": 4.867208,
  "price": 58000
 },
 {
  "id": "n13141500345",
  "name": "Les Jardins de Pachamama",
  "cat": "artisanat",
  "sub": "farm",
  "lat": 43.687384,
  "lon": 4.859102,
  "price": 62500
 },
 {
  "id": "n13141500346",
  "name": "Mas Madeleine",
  "cat": "artisanat",
  "sub": "farm",
  "lat": 43.694717,
  "lon": 4.883454,
  "price": 64500
 },
 {
  "id": "n13205474497",
  "name": "Un Jardin pour Demain",
  "cat": "commerce",
  "sub": "garden_centre",
  "lat": 43.68976,
  "lon": 4.869136,
  "price": 53500
 },
 {
  "id": "w101441983",
  "name": "Mairie de Mouriès",
  "cat": "culture",
  "sub": "townhall",
  "lat": 43.688852,
  "lon": 4.87302,
  "price": 80500
 },
 {
  "id": "w101442035",
  "name": "Le Fournil de l'Olivier",
  "cat": "boulangerie",
  "sub": "bakery",
  "lat": 43.688811,
  "lon": 4.870806,
  "price": 24000
 },
 {
  "id": "w101444060",
  "name": "Le Vallon de Gayet",
  "cat": "restaurant",
  "sub": "restaurant",
  "lat": 43.699781,
  "lon": 4.864028,
  "price": 56500
 },
 {
  "id": "w374452962",
  "name": "Tericiae (Statio)",
  "cat": "culture",
  "sub": "archaeological_site",
  "lat": 43.711513,
  "lon": 4.879265,
  "price": 63500
 },
 {
  "id": "w795102214",
  "name": "Arènes de Mouriès",
  "cat": "sport",
  "sub": "stadium",
  "lat": 43.689278,
  "lon": 4.874461,
  "price": 72500
 },
 {
  "id": "w1162263500",
  "name": "Complexe sportif de L'Espigoulier",
  "cat": "sport",
  "sub": "sports_centre",
  "lat": 43.693314,
  "lon": 4.876271,
  "price": 60500
 }
];
