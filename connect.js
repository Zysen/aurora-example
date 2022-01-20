/*
const mariadb = require('mariadb');
const pool = mariadb.createPool({host: "localhost", user: "root", password: "root", connectionLimit: 5, port: 3307});
pool.getConnection()
    .then(conn => {
    
      conn.query("SELECT 1 as val")
        .then(rows => { // rows: [ {val: 1}, meta: ... ]
          console.log("rows", rows);
		 
        })
        .then(res => { // res: { affectedRows: 1, insertId: 1, warningStatus: 0 }
          console.log("res", res);
		  conn.release(); // release to pool
        })
        .catch(err => {
			console.log(err);
          conn.release(); // release to pool
        })
        
    }).catch(err => {
      //not connected
	  
	  console.log(err);
    });
	
	*/
	
	
	

var mysql      = require('mysql');
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'root',
  database : '',
  port: 3307
});

connection.connect();

connection.query('SELECT 1 + 1 AS solution', function (error, results, fields) {
  if (error) throw error;
  console.log('The solution is: ', results[0].solution);
});

connection.end();

/*
var mysql = require('mysql');
var pool  = mysql.createPool({
  connectionLimit : 10,
  host            : 'localhost',
  user            : 'root',
  password        : 'root',
  database        : 'alphamanager'
});
 
pool.query('SELECT 1 + 1 AS solution', function (error, results, fields) {
  if (error) throw error;
  console.log('The solution is: ', results[0].solution);
});

*/


/*
const mysql = require('mysql');
let pool = mysql.createPool({
					"host": "localhost",
					"user": "root",
					"password": "root",
					"database": "alphamanager",
					"backup": ".",
					"port":3306,
					"debug": true,
					"trace":true
				});
				
pool.getConnection(function (err, connection) {
	console.log("connect", err);
});	
*/