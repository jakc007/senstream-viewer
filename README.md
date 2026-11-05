# Senstream Viewer

Slovenski pregledovalnik izvornih datotek .senstream. Odprite stran, izberite eno ali več datotek in raziščite signale ter dogodke.

Podatki se razpakirajo in obdelajo samo v brskalniku. Aplikacija ne vsebuje strežnika za nalaganje meritev in ne shranjuje meritev. Koda ne vključuje vzorčnih osebnih posnetkov.

## Funkcije

- Izbira datotek in povleci/spusti, preklop med posnetki
- Izbira vseh številskih signalov in posameznih naprav
- Grafi vseh izvornih vzorcev, povečava, premikanje, časovni drsnik in vnos intervala
- Markerji na časovni osi in seznam dogodkov s skokom na dogodek
- Izvoz grafa PNG in podatkov izbranega signala CSV
- Opozorila za neveljavne vrstice in prazne posnetke

## Zagon in objava

Statična stran brez koraka gradnje. Lokalno zaženite statični HTTP strežnik v tej mapi. Na Vercelu izberite framework Other, pustite build command prazen in uporabite korensko mapo.

Knjižnice JSZip 3.10.1 in Plotly.js 3.3.0 se naložijo prek CDN. Pisava DM Sans se naloži prek Google Fonts. Za prvo odpiranje je potrebna internetna povezava.

## Format in meje

Podprt je ZIP zapis s session.json in signalFiles/<naprava>/<signal>.csv. Številski signali vsebujejo čas v mikrosekundah od začetka in izvorno vrednost. Markerji so brani kot čas v mikrosekundah ter preostala polja z oznako dogodka. Nerazpoznani markerji ostanejo navedeni v opozorilih. Njihov prikaz je preverjen s sintetičnimi markerji, dostopni izvorni posnetek ni vseboval markerjev.

Prstani so poimenovani po izvornih oznakah naprav. Program ne sklepa, kateri osebi pripada posamezen prstan. Kjer format ne določa enote, je os označena kot izvorna vrednost. SCL in SCR se na novo ne računata.

Velikost posnetkov je omejena s pomnilnikom brskalnika. Vsi izbrani posnetki ostanejo v pomnilniku do osvežitve ali zaprtja strani.

