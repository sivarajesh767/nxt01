const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const app = express()

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
let database = null

app.use(express.json())

const initlizeDbReverse = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () =>
      console.log('Server Running at hhtp://localhost:3000/'),
    )
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}
initlizeDbReverse()

const stateTable = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}
const districtTable = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    curved: dbObject.curved,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

function authenticateToken(request, response, next) {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, MY_SECRET_TOKEN, async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else next()
    })
  }
}
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`
  const databaseUser = await database.get(selectUserQuery)

  if (databaseUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isMatchedPassword = await bcrypt.compare(
      password,
      databaseUser.password,
    )
    if (isMatchedPassword === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

app.get('/states/', authenticateToken, async (request, response) => {
  const getUserQuery = `
  SELECT
  *
  FROM
  state;`

  const databaseUser = await database.all(getUserQuery)
  response.send(databaseUser.map(eachArray => stateTable(eachArray)))
})

app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const selectUserQuery = `SELECT * FROM state WHERE state_id = '${stateId}';`
  const databaseUser = await database.get(selectUserQuery)
  response.send(stateTable(databaseUser))
})

app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const createUserQuery = `
  INSERT INTO
  district (districtName, stateId, cases, cured, active, deaths)
  VALUES
  ('${districtName}', '${stateId}', '${cases}', '${cured}', '${active}', '${deaths}');`

  await database.run(createUserQuery)
  response.send('District Successfully Added')
})

app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const selectUserQuery = `SELECT * FROM district WHERE district_id = '${districtId}';`
    const databaseUser = await database.get(selectUserQuery)
    response.send(districtTable(databaseUser))
  },
)

app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteUserQuery = `
  DELETE FROM
  district
  WHERE
  district_id = '${districtId}';
  `

   await database.run(deleteUserQuery)
    response.send('District Removed')
  },
)
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateUserQuery = `
  UPDATE 
  district

  SET
  district_name = '${districtName}'
  state_id = '${stateId}'
  cases = '${cases}'
  cured = '${cured}'
  active = '${active}'
  deaths = '${deaths}'
  
  WHERE
  district_id = '${districtId}';`

    await database.run(updateUserQuery)
    response.send('District Details Updated')
  },
)

app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getUserQuery = `
  SELECT 
  SUM(cases),
  SUM(cured),
  SUM(active),
  SUM(deaths)
  FROM
  district
  WHERE
  state_id = '${stateId}';`

    const stats = await database.get(getUserQuery)
    response.send({
      totalCases: stats['SUM(cases)'],
      totalCured: stats['SUM(cured)'],
      totalActive: stats['SUM(active)'],
      totalDeaths: stats['SUM(deaths)'],
    })
  },
)
module.exports = app
