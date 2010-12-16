# Generate load for testing

A great utility for generating load is `stress`

    sudo apt-get install stress

Generate CPU (usr) load

    stress -c 1

Generate CPU (sys) load

    sudo ping -l 100000 -q -s 10 -f localhost


