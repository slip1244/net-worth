# net-worth
Track net worth of cryptocurrency holdings through a discord bot, and show a live ticker as your custom status

## setup
1. fill out lines 3 to 6. id is your discord id, name is the preferred name you'd like the bot to display, token is your token, pfpUrl is a link to a profile picture
2. run

## commands
* !nw
  * displays your net worth and holdings
* !cs <coin> *<precision>*
  * sets your status to a live ticker of a selected coin/token with a configurable precision
  * leave precision blank to use preset precision
* !us <coin> < = / + > <value>
  * updates your holdings of a coin/token
  * use = to set it to a value, or use + to add it (add a negative number to subtract)
  * = to 0 removes the holding
* !uw < + / - > <user id>
  * add or remove a user from your net worth whitelist (controls whether they can pull up your !nw or not)
  * + to add to whitelist, - to remove
  
  this version is flawed, will be releasing a new version which won't hit coingecko's ratelimit and will have debt for tracking leveraged positions or yield farming through loans
