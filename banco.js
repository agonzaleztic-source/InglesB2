/**
 * Banco de contenido de la app — funciona sin conexión al modelo.
 *
 * Cada entrada tiene la misma forma que devolvería el modelo, así que los
 * ejercicios se pintan con el mismo código en los dos modos.
 *
 *   why  = la explicación que sale siempre al corregir.
 *   deep = la que sale al pulsar "Explícamelo mejor" cuando has fallado.
 */
window.BANK = {

/* ================================================================
   CORE · Gramática y vocabulario
   Se sacan 6 preguntas de esta bolsa: las que no hayas visto todavía.
   ================================================================ */
core: [

/* ---- Condicionales ---- */
{ q: "If I ___ about the strike, I wouldn't have driven to work.",
  opts: ["knew", "had known", "would know", "have known"], correct: 1,
  tag: "Tercer condicional",
  why: "El resultado es pasado y ya no tiene remedio, así que la condición va en past perfect.",
  deep: { rule: "El tercer condicional habla de algo que ya no se puede cambiar: if + past perfect en la condición, would have + participio en el resultado. Sirve para lamentar o reprochar.",
    mistake: "«Knew» es de segundo condicional y hablaría del presente; el «wouldn't have driven» ya te dice que el resultado es pasado.",
    examples: [ { en: "If she had left earlier, she would have caught the train.", es: "Si hubiera salido antes, habría cogido el tren." },
                { en: "If we hadn't booked, we wouldn't have got a table.", es: "Si no hubiéramos reservado, no habríamos conseguido mesa." } ] } },

{ q: "If you ___ me, I'd have helped you move house.",
  opts: ["asked", "would ask", "had asked", "ask"], correct: 2,
  tag: "Tercer condicional",
  why: "«I'd have helped» obliga a que la condición vaya en past perfect: had asked.",
  deep: { rule: "Cuando el resultado es «would have + participio», la condición es siempre «had + participio». Las dos mitades viven en el mismo tiempo mental: el pasado que no ocurrió.",
    mistake: "«Asked» mezcla el segundo condicional con el tercero. Ese cruce solo se admite en el condicional mixto, y allí el resultado va en presente.",
    examples: [ { en: "If they had told me, I would have come.", es: "Si me lo hubieran dicho, habría venido." },
                { en: "If I had studied law, I'd have been miserable.", es: "Si hubiera estudiado derecho, habría sido infeliz." } ] } },

{ q: "If I had taken that job, I ___ in Berlin now.",
  opts: ["would live", "would have lived", "will live", "lived"], correct: 0,
  tag: "Condicional mixto",
  why: "Condición en el pasado pero consecuencia en el presente: «now» pide would + infinitivo.",
  deep: { rule: "El condicional mixto une un pasado que no pasó con su consecuencia de hoy: if + past perfect, would + infinitivo. La pista suele ser un adverbio de presente como now o today.",
    mistake: "«Would have lived» dejaría también la consecuencia en el pasado, y entonces «now» no encajaría.",
    examples: [ { en: "If I hadn't missed the flight, I'd be at home now.", es: "Si no hubiera perdido el vuelo, ahora estaría en casa." },
                { en: "If she had saved more, she wouldn't be worried today.", es: "Si hubiera ahorrado más, hoy no estaría preocupada." } ] } },

/* ---- Present perfect y past simple ---- */
{ q: "I ___ my keys. I can't get into the flat.",
  opts: ["lost", "have lost", "was losing", "had lost"], correct: 1,
  tag: "Present perfect",
  why: "El pasado importa por su consecuencia de ahora: no puede entrar. Eso pide present perfect.",
  deep: { rule: "El present perfect conecta un hecho pasado con el presente. Si lo que cuenta es el resultado de ahora, y no cuándo pasó, va have/has + participio.",
    mistake: "«Lost» en pasado simple pediría un momento concreto (yesterday, this morning) y perdería el vínculo con el presente.",
    examples: [ { en: "He's broken his arm, so he can't play.", es: "Se ha roto el brazo, así que no puede jugar." },
                { en: "We've missed the bus. We'll have to walk.", es: "Hemos perdido el autobús. Tendremos que ir andando." } ] } },

{ q: "She ___ for the same company since she left university.",
  opts: ["works", "worked", "has worked", "is working"], correct: 2,
  tag: "Present perfect con since",
  why: "«Since» marca un periodo que empieza en el pasado y llega hasta hoy: present perfect.",
  deep: { rule: "Con for y since, el inglés usa present perfect para lo que empezó antes y sigue siendo verdad. El español usa presente, y de ahí sale el error.",
    mistake: "«Works» es la traducción literal de «trabaja desde que…», pero en inglés el presente simple no puede llevar since.",
    examples: [ { en: "I've lived here for ten years.", es: "Vivo aquí desde hace diez años." },
                { en: "They've known each other since school.", es: "Se conocen desde el colegio." } ] } },

{ q: "___ you ever ___ to Scotland?",
  opts: ["Did / go", "Have / been", "Are / going", "Had / been"], correct: 1,
  tag: "Present perfect de experiencia",
  why: "Para experiencias de vida sin fecha se usa have been, no have gone.",
  deep: { rule: "«Have you ever been…?» pregunta por la experiencia acumulada. Been implica que fuiste y volviste; gone implica que sigues allí.",
    mistake: "«Did you go» pediría un momento concreto, y «ever» dice justamente que no lo hay.",
    examples: [ { en: "Have you ever tried Korean food?", es: "¿Has probado alguna vez comida coreana?" },
                { en: "She's gone to the bank. She'll be back soon.", es: "Ha ido al banco. Vuelve enseguida." } ] } },

/* ---- Futuro perfecto y continuo ---- */
{ q: "By the time you arrive, we ___ dinner.",
  opts: ["will finish", "will have finished", "finish", "are finishing"], correct: 1,
  tag: "Future perfect",
  why: "«By the time» fija un punto futuro y algo ya terminado antes de él: future perfect.",
  deep: { rule: "El future perfect (will have + participio) dice que algo estará acabado antes de otro momento futuro. Lo dispara by + tiempo o by the time.",
    mistake: "«Will finish» solo dice que ocurrirá, no que ya estará hecho cuando llegues.",
    examples: [ { en: "By 2030 they will have built the new line.", es: "Para 2030 habrán construido la nueva línea." },
                { en: "I'll have read it by Friday.", es: "Lo habré leído para el viernes." } ] } },

{ q: "Don't call at eight — I ___ then.",
  opts: ["will drive", "will be driving", "drive", "will have driven"], correct: 1,
  tag: "Future continuous",
  why: "Una acción en curso en un momento futuro concreto: will be + gerundio.",
  deep: { rule: "El future continuous describe lo que estarás haciendo en un momento dado del futuro. Se usa mucho para explicar por qué no estarás disponible.",
    mistake: "«Will drive» presenta la acción como completa o como una decisión, no como algo en marcha a esa hora.",
    examples: [ { en: "This time tomorrow I'll be flying to Rome.", es: "Mañana a esta hora estaré volando a Roma." },
                { en: "She'll be working late all week.", es: "Estará trabajando hasta tarde toda la semana." } ] } },

/* ---- Pasiva ---- */
{ q: "The bridge ___ last year after the flood.",
  opts: ["repaired", "was repaired", "has repaired", "is repairing"], correct: 1,
  tag: "Pasiva en pasado",
  why: "El puente recibe la acción y hay una fecha pasada: was + participio.",
  deep: { rule: "La pasiva se forma con be en el tiempo que toque más el participio. Se usa cuando quien hace la acción no importa o no se sabe.",
    mistake: "«Repaired» dejaría al puente reparando algo a alguien. El sujeto no puede hacer la acción aquí.",
    examples: [ { en: "The results were announced on Monday.", es: "Los resultados se anunciaron el lunes." },
                { en: "My bike was stolen last night.", es: "Me robaron la bici anoche." } ] } },

{ q: "It ___ that the new rules will come into force in June.",
  opts: ["is expected", "expects", "has expected", "is expecting"], correct: 0,
  tag: "Pasiva impersonal",
  why: "«It is expected that…» es la fórmula impersonal para lo que se cree o se espera.",
  deep: { rule: "El inglés formal usa it is said / believed / expected / thought that… donde el español dice «se dice que…». Aparece mucho en los textos de opinión del Reading.",
    mistake: "«Expects» necesitaría un sujeto humano concreto: alguien que espera.",
    examples: [ { en: "It is believed that the painting is genuine.", es: "Se cree que el cuadro es auténtico." },
                { en: "It is said that the house is over 300 years old.", es: "Se dice que la casa tiene más de 300 años." } ] } },

/* ---- Estilo indirecto ---- */
{ q: "She said she ___ the report the following day.",
  opts: ["will send", "sends", "would send", "is sending"], correct: 2,
  tag: "Estilo indirecto",
  why: "Al pasar a estilo indirecto tras «said», will se convierte en would.",
  deep: { rule: "Cuando el verbo introductorio va en pasado, los tiempos retroceden un paso: present→past, will→would, can→could. Los marcadores también cambian: tomorrow→the following day.",
    mistake: "«Will send» mantiene el tiempo original; eso solo se deja si lo dicho sigue siendo verdad ahora mismo.",
    examples: [ { en: "He told me he was living in Bilbao.", es: "Me dijo que vivía en Bilbao." },
                { en: "They said they could help us.", es: "Dijeron que podían ayudarnos." } ] } },

{ q: "He ___ me to book the tickets in advance.",
  opts: ["said", "told", "suggested", "insisted"], correct: 1,
  tag: "Verbos de reporte",
  why: "Tell + persona + to + infinitivo. Say no lleva objeto de persona y suggest no admite «persona + to».",
  deep: { rule: "Cada verbo de reporte tiene su estructura fija: tell/advise/ask someone to do algo; suggest doing o suggest that…; say something to someone.",
    mistake: "«Suggested me to book» es el error más repetido del hispanohablante: suggest nunca va con «persona + to».",
    examples: [ { en: "She suggested taking the early train.", es: "Sugirió coger el tren temprano." },
                { en: "They advised us to arrive an hour early.", es: "Nos aconsejaron llegar una hora antes." } ] } },

/* ---- Oraciones de relativo ---- */
{ q: "The woman ___ car was blocking the entrance has moved it.",
  opts: ["who", "whose", "which", "that"], correct: 1,
  tag: "Relativo posesivo",
  why: "Whose marca posesión: el coche es de la mujer.",
  deep: { rule: "Whose es el único relativo posesivo y vale para personas y para cosas. Va pegado al sustantivo poseído, sin artículo entre medias.",
    mistake: "«Who» sustituiría a la mujer como sujeto, pero quien bloqueaba la entrada era el coche, no ella.",
    examples: [ { en: "That's the neighbour whose dog barks all night.", es: "Ese es el vecino cuyo perro ladra toda la noche." },
                { en: "A company whose profits fell must cut costs.", es: "Una empresa cuyos beneficios cayeron debe recortar gastos." } ] } },

{ q: "My brother, ___ lives in Vigo, is coming for the weekend.",
  opts: ["that", "who", "which", "what"], correct: 1,
  tag: "Relativo explicativo",
  why: "Entre comas la información es añadida y no admite that: con personas va who.",
  deep: { rule: "Las explicativas van entre comas y solo admiten who o which, nunca that. Las especificativas, sin comas, sí admiten that.",
    mistake: "«That» es correcto en «The man that called…», sin comas, pero es imposible dentro de una explicativa.",
    examples: [ { en: "The library, which opened in 1920, is being restored.", es: "La biblioteca, que abrió en 1920, se está restaurando." },
                { en: "The man who called you is waiting outside.", es: "El hombre que te llamó está esperando fuera." } ] } },

/* ---- Modales de deducción ---- */
{ q: "The lights are off. They ___ be out.",
  opts: ["must", "can", "should", "would"], correct: 0,
  tag: "Modal de deducción",
  why: "Must expresa una deducción segura a partir de una prueba.",
  deep: { rule: "Para deducir en presente: must be (seguro que sí), can't be (seguro que no), might/could be (quizá). Para deducir nunca se usa can be.",
    mistake: "«Can be» significa «es posible en general», no «deduzco que es así ahora mismo».",
    examples: [ { en: "She's not answering — she must be asleep.", es: "No contesta; seguro que está dormida." },
                { en: "That can't be right, the shop closed years ago.", es: "Eso no puede ser, la tienda cerró hace años." } ] } },

{ q: "He ___ have missed the train — he left two hours ago.",
  opts: ["must", "can't", "should", "mustn't"], correct: 1,
  tag: "Deducción negativa",
  why: "Can't have + participio es la deducción negativa sobre el pasado.",
  deep: { rule: "Para negar una deducción sobre el pasado se usa can't have + participio, no mustn't have. Mustn't expresa prohibición, no imposibilidad.",
    mistake: "«Mustn't have missed» suena a prohibición retroactiva y no existe con este sentido.",
    examples: [ { en: "They can't have finished already, it's only ten.", es: "No pueden haber terminado ya, son solo las diez." },
                { en: "You must have left it at the office.", es: "Te lo habrás dejado en la oficina." } ] } },

/* ---- Wish e if only ---- */
{ q: "I wish I ___ how to drive.",
  opts: ["know", "knew", "would know", "have known"], correct: 1,
  tag: "Wish de presente",
  why: "Wish + past simple para lamentar algo del presente que no es así.",
  deep: { rule: "Wish retrocede un tiempo: para el presente, past simple; para el pasado, past perfect; para pedir un cambio de conducta ajena, would.",
    mistake: "«I wish I know» es la traducción directa de «ojalá sé», que en español tampoco se dice: es «ojalá supiera».",
    examples: [ { en: "I wish I had more free time.", es: "Ojalá tuviera más tiempo libre." },
                { en: "I wish I hadn't said that.", es: "Ojalá no hubiera dicho eso." } ] } },

{ q: "If only they ___ so loudly at night!",
  opts: ["don't talk", "didn't talk", "wouldn't talk", "haven't talked"], correct: 2,
  tag: "If only con would",
  why: "Would señala molestia por una conducta ajena que se repite.",
  deep: { rule: "Con wish y if only, would sirve para quejarse de lo que otra persona hace una y otra vez. No se usa para uno mismo.",
    mistake: "«Didn't talk» sería un lamento neutro; el matiz de queja por costumbre ajena solo lo da would.",
    examples: [ { en: "I wish you wouldn't leave the door open.", es: "Ojalá no dejaras la puerta abierta." },
                { en: "If only he would listen for once!", es: "¡Ojalá escuchara por una vez!" } ] } },

/* ---- Gerundio o infinitivo ---- */
{ q: "I can't afford ___ a new laptop this year.",
  opts: ["buying", "to buy", "buy", "bought"], correct: 1,
  tag: "Verbo + infinitivo",
  why: "Afford va siempre con to + infinitivo.",
  deep: { rule: "Hay verbos que solo aceptan infinitivo (afford, decide, manage, refuse, hope), otros solo gerundio (enjoy, avoid, mind, suggest), y hay que aprenderlos por grupos.",
    mistake: "El español dice «no puedo permitirme comprar», y ese «comprar» tienta a poner gerundio en inglés.",
    examples: [ { en: "They managed to fix it themselves.", es: "Consiguieron arreglarlo ellos mismos." },
                { en: "She refused to sign the contract.", es: "Se negó a firmar el contrato." } ] } },

{ q: "I don't mind ___ early if it helps.",
  opts: ["to start", "start", "starting", "started"], correct: 2,
  tag: "Verbo + gerundio",
  why: "Mind va siempre seguido de gerundio.",
  deep: { rule: "Después de mind, enjoy, avoid, finish, practise, imagine y de cualquier preposición, el verbo va en -ing.",
    mistake: "«I don't mind to start» calca el infinitivo español y es de los fallos más frecuentes del Core.",
    examples: [ { en: "Would you mind waiting a moment?", es: "¿Te importaría esperar un momento?" },
                { en: "He avoided answering the question.", es: "Evitó responder a la pregunta." } ] } },

{ q: "I stopped ___ coffee because it kept me awake.",
  opts: ["to drink", "drinking", "drink", "drunk"], correct: 1,
  tag: "Stop con gerundio",
  why: "Stop + gerundio es dejar de hacer algo. Stop + to sería parar con el fin de hacer otra cosa.",
  deep: { rule: "Un puñado de verbos cambian de significado: stop, remember, forget y try. Con gerundio miran a lo que ya se hacía; con infinitivo, a la intención.",
    mistake: "«Stopped to drink coffee» significaría que paró para tomarse un café, justo lo contrario.",
    examples: [ { en: "Remember to lock the door.", es: "Acuérdate de cerrar con llave." },
                { en: "I remember locking the door.", es: "Recuerdo haber cerrado con llave." } ] } },

/* ---- Inversión ---- */
{ q: "Not only ___ late, but he also forgot the tickets.",
  opts: ["he was", "was he", "he is", "he had"], correct: 1,
  tag: "Inversión con not only",
  why: "Al empezar la frase con not only, el sujeto y el auxiliar se invierten.",
  deep: { rule: "Cuando la frase arranca con una expresión negativa o restrictiva (not only, never, rarely, hardly, no sooner), el orden pasa a ser auxiliar + sujeto, como en una pregunta.",
    mistake: "«Not only he was» mantiene el orden normal y suena incorrecto en inglés escrito formal.",
    examples: [ { en: "Never have I seen such a mess.", es: "Nunca he visto semejante desorden." },
                { en: "Rarely does he complain.", es: "Rara vez se queja." } ] } },

{ q: "Hardly ___ the house when it started to pour.",
  opts: ["we had left", "had we left", "we left", "did we left"], correct: 1,
  tag: "Inversión con hardly",
  why: "Hardly al principio obliga a invertir: had we left.",
  deep: { rule: "Hardly/scarcely… when y no sooner… than describen dos hechos casi simultáneos. El primero va en past perfect e invertido.",
    mistake: "«Did we left» dobla el pasado: después de un auxiliar el verbo va en infinitivo.",
    examples: [ { en: "No sooner had she arrived than the phone rang.", es: "Nada más llegar, sonó el teléfono." },
                { en: "Hardly had I sat down when the bell went.", es: "Apenas me había sentado cuando sonó el timbre." } ] } },

/* ---- Used to, would, be used to ---- */
{ q: "I'm not used to ___ up so early.",
  opts: ["get", "getting", "got", "to get"], correct: 1,
  tag: "Be used to + gerundio",
  why: "En be used to, «to» es preposición, así que va seguida de gerundio.",
  deep: { rule: "Distingue tres cosas: used to + infinitivo (costumbre pasada), be used to + gerundio (estar acostumbrado) y get used to + gerundio (acostumbrarse).",
    mistake: "Como used to sí lleva infinitivo, se arrastra el infinitivo a be used to. Pero aquí el «to» es otra cosa: una preposición.",
    examples: [ { en: "She's used to working under pressure.", es: "Está acostumbrada a trabajar bajo presión." },
                { en: "I used to work nights.", es: "Antes trabajaba de noche." } ] } },

{ q: "When we were children we ___ spend every summer at my grandmother's.",
  opts: ["used", "would", "use to", "are used to"], correct: 1,
  tag: "Would de costumbre",
  why: "Would sirve para costumbres pasadas repetidas, igual que used to.",
  deep: { rule: "Would vale para acciones repetidas del pasado, pero no para estados. Con verbos de estado (be, have, live, know) solo se puede usar used to.",
    mistake: "«We would live there» es incorrecto porque live es un estado; ahí hace falta used to live.",
    examples: [ { en: "Every Sunday he would take us to the beach.", es: "Todos los domingos nos llevaba a la playa." },
                { en: "We used to have a dog.", es: "Antes teníamos un perro." } ] } },

/* ---- Artículos y sustantivos incontables ---- */
{ q: "Could you give me ___ advice about the course?",
  opts: ["an", "some", "a few", "many"], correct: 1,
  tag: "Sustantivo incontable",
  why: "Advice es incontable: no admite a/an ni plural. Lleva some.",
  deep: { rule: "En inglés son incontables advice, information, news, furniture, luggage, work y research. Para contarlos hace falta un envase: a piece of advice.",
    mistake: "En español «un consejo» es contable, y de ahí sale «an advice», que es error seguro.",
    examples: [ { en: "She gave me some useful information.", es: "Me dio información útil." },
                { en: "That's a very good piece of news.", es: "Esa es una muy buena noticia." } ] } },

{ q: "___ life in a small village can be quieter than people think.",
  opts: ["The", "A", "Sin artículo", "Some"], correct: 2,
  tag: "Artículo cero",
  why: "En generalizaciones con sustantivos abstractos o incontables no se pone artículo.",
  deep: { rule: "Cuando hablas de algo en general (life, music, money, people), el inglés no lleva artículo. The solo aparece si concretas de cuál hablas.",
    mistake: "El español sí pone artículo («la vida»), y arrastrarlo produce «the life is difficult», que delata el nivel enseguida.",
    examples: [ { en: "Music helps me concentrate.", es: "La música me ayuda a concentrarme." },
                { en: "The music at the party was too loud.", es: "La música de la fiesta estaba demasiado alta." } ] } },

/* ---- Collocations ---- */
{ q: "We need to ___ a decision before Friday.",
  opts: ["do", "make", "take", "have"], correct: 1,
  tag: "Collocation con make",
  why: "Make a decision. En inglés las decisiones se hacen, no se toman.",
  deep: { rule: "Make sirve para lo que se crea o se produce (a decision, a mistake, an effort, progress); do, para tareas y trabajo (the shopping, homework, the washing-up).",
    mistake: "El español dice «tomar una decisión», y eso empuja hacia take, que aquí no funciona.",
    examples: [ { en: "He made a real effort to be on time.", es: "Hizo un verdadero esfuerzo por llegar puntual." },
                { en: "I've made a mistake on this form.", es: "Me he equivocado en este formulario." } ] } },

{ q: "She's going to ___ a course in graphic design.",
  opts: ["make", "do", "take part", "have"], correct: 1,
  tag: "Collocation con do",
  why: "Do a course. Make no acompaña nunca a course.",
  deep: { rule: "Do acompaña a actividades y trabajo sin resultado tangible: do a course, do research, do business, do your best.",
    mistake: "Como en español se dice «hacer un curso» y make también es «hacer», la elección se vuelve una moneda al aire. Aquí es do.",
    examples: [ { en: "They do business all over Europe.", es: "Hacen negocios por toda Europa." },
                { en: "Just do your best.", es: "Haz lo que puedas." } ] } },

{ q: "Let's ___ a break — we've been at this for hours.",
  opts: ["do", "make", "take", "give"], correct: 2,
  tag: "Collocation con take",
  why: "Take a break, take a rest, take a look: los descansos y los vistazos se toman.",
  deep: { rule: "Take acompaña a acciones breves que uno se concede: a break, a rest, a look, a seat, a photo, a shower.",
    mistake: "«Make a break» existe, pero significa escaparse, no descansar.",
    examples: [ { en: "Take a look at this before you sign.", es: "Échale un vistazo a esto antes de firmar." },
                { en: "Take a seat, she'll be with you shortly.", es: "Tome asiento, le atenderá enseguida." } ] } },

/* ---- Phrasal verbs ---- */
{ q: "The meeting was ___ off because half the team was ill.",
  opts: ["put", "called", "taken", "brought"], correct: 1,
  tag: "Phrasal verb: call off",
  why: "Call off es cancelar. Put off sería aplazar, que no es lo que dice la frase.",
  deep: { rule: "Call off cancela definitivamente; put off traslada a otra fecha. La diferencia se pregunta mucho porque en español ambas caben bajo «suspender».",
    mistake: "«Put off» dejaría la reunión pendiente para otro día, pero la frase da a entender que no se hace.",
    examples: [ { en: "They called off the match because of the storm.", es: "Cancelaron el partido por la tormenta." },
                { en: "We've put the trip off until May.", es: "Hemos aplazado el viaje hasta mayo." } ] } },

{ q: "I'm looking ___ to the summer holidays.",
  opts: ["forward", "after", "for", "up"], correct: 0,
  tag: "Phrasal verb: look forward to",
  why: "Look forward to es tener ganas de. Lleva siempre to + gerundio o sustantivo.",
  deep: { rule: "Cuidado con el «to» de look forward to: es preposición, así que detrás va -ing, nunca infinitivo.",
    mistake: "«I look forward to see you» es el fallo clásico; lo correcto es to seeing you.",
    examples: [ { en: "I'm looking forward to meeting your family.", es: "Tengo ganas de conocer a tu familia." },
                { en: "She looks after her neighbour's cat.", es: "Cuida del gato de su vecina." } ] } },

{ q: "We've ___ out of milk again.",
  opts: ["gone", "run", "got", "come"], correct: 1,
  tag: "Phrasal verb: run out of",
  why: "Run out of es quedarse sin algo.",
  deep: { rule: "Run out of se usa para lo que se agota: milk, petrol, time, patience, ideas.",
    mistake: "«Go out of» no existe con ese sentido; go out es salir.",
    examples: [ { en: "We're running out of time.", es: "Se nos está acabando el tiempo." },
                { en: "The car ran out of petrol on the motorway.", es: "El coche se quedó sin gasolina en la autopista." } ] } },

/* ---- Preposiciones dependientes ---- */
{ q: "The result depends ___ how many people sign up.",
  opts: ["of", "on", "in", "from"], correct: 1,
  tag: "Preposición dependiente",
  why: "Depend on, siempre. Depend of no existe.",
  deep: { rule: "La preposición la manda el verbo inglés, no la traducción: depend on, insist on, consist of, belong to, succeed in.",
    mistake: "«Depend of» viene directo de «depender de» y es probablemente el error de preposición número uno del hispanohablante.",
    examples: [ { en: "It depends on the weather.", es: "Depende del tiempo." },
                { en: "The course consists of six modules.", es: "El curso consta de seis módulos." } ] } },

{ q: "She's very good ___ solving problems under pressure.",
  opts: ["in", "on", "at", "for"], correct: 2,
  tag: "Adjetivo + preposición",
  why: "Good at + gerundio. La preposición la pide el adjetivo.",
  deep: { rule: "Cada adjetivo trae su preposición fija: good/bad at, interested in, worried about, afraid of, keen on. Después siempre va gerundio.",
    mistake: "«Good in» calca «bueno en» y no funciona cuando se habla de habilidades.",
    examples: [ { en: "He's interested in learning Japanese.", es: "Le interesa aprender japonés." },
                { en: "I'm worried about the exam.", es: "Estoy preocupado por el examen." } ] } },

{ q: "They congratulated her ___ passing the exam.",
  opts: ["for", "on", "about", "by"], correct: 1,
  tag: "Verbo + preposición",
  why: "Congratulate someone on something.",
  deep: { rule: "Varios verbos de reacción llevan preposición fija: congratulate on, apologise for, complain about, blame for, thank for.",
    mistake: "El español «felicitar por» empuja hacia for, pero congratulate va con on.",
    examples: [ { en: "He apologised for being late.", es: "Se disculpó por llegar tarde." },
                { en: "She complained about the noise.", es: "Se quejó del ruido." } ] } },

/* ---- Falsos amigos ---- */
{ q: "I'd like to ___ a table for four, please.",
  opts: ["reserve", "record", "realise", "resume"], correct: 0,
  tag: "Falso amigo",
  why: "Reservar es reserve o book. Record es grabar y realise es darse cuenta.",
  deep: { rule: "Los falsos amigos se cuelan en el Core porque la opción parecida al español siempre está entre las cuatro. Desconfía de la que se parece demasiado.",
    mistake: "«Realise» parece «realizar», pero significa darse cuenta. Realizar es carry out o do.",
    examples: [ { en: "I didn't realise you were waiting.", es: "No me di cuenta de que estabas esperando." },
                { en: "They carried out a survey.", es: "Realizaron una encuesta." } ] } },

{ q: "The teacher asked us to ___ the main ideas of the text.",
  opts: ["resume", "summarise", "assume", "pretend"], correct: 1,
  tag: "Falso amigo",
  why: "Resumir es summarise. Resume significa reanudar.",
  deep: { rule: "Cuatro trampas muy frecuentes: resume (reanudar) no es resumir; assume (suponer) no es asumir; pretend (fingir) no es pretender; actually (en realidad) no es actualmente.",
    mistake: "«Resume» es el falso amigo perfecto: existe, es común y significa otra cosa.",
    examples: [ { en: "He pretended not to hear me.", es: "Fingió no oírme." },
                { en: "Actually, I've already eaten.", es: "En realidad, ya he comido." } ] } },

{ q: "___ , the shop is closed on Mondays.",
  opts: ["Actually", "Currently", "Eventually", "Sensibly"], correct: 1,
  tag: "Falso amigo",
  why: "Actualmente es currently. Actually significa en realidad.",
  deep: { rule: "Actually contradice o matiza; currently sitúa en el presente. Y eventually es finalmente, no eventualmente.",
    mistake: "Actually es el falso amigo más repetido de todos y se cuela también en el Writing.",
    examples: [ { en: "She's currently working in Dublin.", es: "Actualmente trabaja en Dublín." },
                { en: "Eventually they found a solution.", es: "Finalmente encontraron una solución." } ] } },

/* ---- Conectores ---- */
{ q: "The flat is small. ___ , it's in the perfect location.",
  opts: ["Therefore", "However", "Moreover", "Because"], correct: 1,
  tag: "Conector de contraste",
  why: "Las dos ideas se oponen, así que hace falta un conector de contraste.",
  deep: { rule: "Contraste: however, nevertheless, on the other hand. Consecuencia: therefore, as a result, consequently. Adición: moreover, in addition.",
    mistake: "«Therefore» invertiría el sentido: diría que por ser pequeño está bien situado.",
    examples: [ { en: "It rained all week. Nevertheless, we enjoyed it.", es: "Llovió toda la semana. Aun así, lo disfrutamos." },
                { en: "Sales fell. As a result, prices were cut.", es: "Las ventas cayeron. En consecuencia, se bajaron los precios." } ] } },

{ q: "___ the heavy traffic, we arrived on time.",
  opts: ["Although", "Despite", "However", "Because of"], correct: 1,
  tag: "Despite frente a although",
  why: "Despite va seguido de sustantivo; although necesita sujeto y verbo.",
  deep: { rule: "Despite e in spite of van con sustantivo o gerundio. Although y even though van con una frase completa. Es un error de estructura, no de significado.",
    mistake: "«Despite the traffic was heavy» es incorrecto: ahí haría falta although.",
    examples: [ { en: "Despite the rain, the match went ahead.", es: "A pesar de la lluvia, el partido siguió adelante." },
                { en: "Although it was raining, we walked.", es: "Aunque llovía, fuimos andando." } ] } },

/* ---- Registro ---- */
{ q: "(Email formal) I am writing to ___ about the delay in my order.",
  opts: ["moan", "enquire", "chat", "check out"], correct: 1,
  tag: "Registro formal",
  why: "Enquire es el verbo formal. Moan, chat y check out son coloquiales.",
  deep: { rule: "En Writing 4 la parte formal se juega en el registro: enquire, request, apologise, inform, regret. Los phrasal verbs coloquiales bajan la nota.",
    mistake: "Mezclar registros es lo que más penaliza: un «check out» en un email formal delata el nivel.",
    examples: [ { en: "I would be grateful if you could confirm the date.", es: "Le agradecería que confirmara la fecha." },
                { en: "I regret to inform you that the event is cancelled.", es: "Lamento informarle de que el evento queda cancelado." } ] } },

{ q: "(Mensaje a un amigo) ___ we meet at seven instead?",
  opts: ["Would it be possible that", "Shall", "I should be grateful if", "I request that"], correct: 1,
  tag: "Registro informal",
  why: "Shall we…? es natural entre amigos; las otras son de email formal.",
  deep: { rule: "El Aptis premia acertar el registro de cada parte: Writing 3 y la primera mitad de Writing 4 son informales; la segunda mitad, formal.",
    mistake: "Pasarse de formal con un amigo penaliza igual que ser coloquial con el director.",
    examples: [ { en: "Fancy going for a coffee?", es: "¿Te apetece ir a por un café?" },
                { en: "How about Saturday instead?", es: "¿Qué tal el sábado mejor?" } ] } },

/* ---- Adjetivos e intensidad ---- */
{ q: "The view from the top was absolutely ___ .",
  opts: ["very beautiful", "stunning", "quite good", "more beautiful"], correct: 1,
  tag: "Adjetivo fuerte",
  why: "Absolutely pide un adjetivo extremo: stunning, no «very beautiful».",
  deep: { rule: "Los adjetivos extremos (stunning, exhausted, freezing, delighted) van con absolutely o really, nunca con very. Los normales van con very.",
    mistake: "«Absolutely very beautiful» junta dos intensificadores incompatibles.",
    examples: [ { en: "I was absolutely exhausted after the walk.", es: "Estaba agotadísimo después de la caminata." },
                { en: "It was very cold, almost freezing.", es: "Hacía mucho frío, casi helaba." } ] } },

{ q: "I was ___ tired to finish the last exercise.",
  opts: ["so", "too", "very", "enough"], correct: 1,
  tag: "Too frente a enough",
  why: "Too + adjetivo + to significa demasiado… para. Very no impide la acción.",
  deep: { rule: "Too marca un exceso que impide algo; enough va detrás del adjetivo y marca suficiencia: old enough, warm enough.",
    mistake: "«Very tired to finish» no expresa la imposibilidad; para eso hace falta too.",
    examples: [ { en: "She's old enough to decide for herself.", es: "Tiene edad suficiente para decidir por sí misma." },
                { en: "It's too late to call him.", es: "Es demasiado tarde para llamarle." } ] } },

/* ---- Expresiones idiomáticas ---- */
{ q: "Learning the names of all the students was a piece of ___ .",
  opts: ["bread", "cake", "pie", "toast"], correct: 1,
  tag: "Expresión idiomática",
  why: "A piece of cake significa pan comido, muy fácil.",
  deep: { rule: "Las expresiones idiomáticas se aprenden enteras: no se traducen palabra por palabra ni admiten sustituciones.",
    mistake: "«A piece of bread» es literalmente un trozo de pan, sin ningún sentido figurado.",
    examples: [ { en: "The test was a piece of cake.", es: "El examen fue pan comido." },
                { en: "It's not my cup of tea.", es: "No es lo mío." } ] } },

{ q: "I can't decide yet — let me sleep ___ it.",
  opts: ["on", "over", "with", "about"], correct: 0,
  tag: "Expresión idiomática",
  why: "Sleep on it es consultarlo con la almohada.",
  deep: { rule: "Muchas expresiones cotidianas se sostienen sobre una preposición concreta que hay que memorizar junto con la expresión entera.",
    mistake: "Traducir «consultarlo con la almohada» no lleva a ninguna parte: hay que aprender la fórmula hecha.",
    examples: [ { en: "Let's sleep on it and decide tomorrow.", es: "Consultémoslo con la almohada y decidimos mañana." },
                { en: "It's up to you.", es: "Tú decides." } ] } },

],

/* ================================================================
   READING 1 · Palabra en el hueco (banco de palabras, sobran 3)
   ================================================================ */
r1: [
{ intro: "Completa el mensaje con las palabras del banco. Sobran tres.",
  text: "Hi Sam,\n\nThanks for [1] to look after the flat while we're away. The plants only need watering twice a week — please don't [2] them too much. The bins go out on Tuesday night. If the boiler makes a strange noise, don't [3] : just switch it off and I'll deal with it when we're back. I've [4] a spare key under the plant pot. Let me know if you [5] into any trouble.\n\nCheers,\nRosa",
  bank: ["agreeing", "worry", "left", "run", "water", "borrow", "remind", "fall"],
  answers: [0, 4, 1, 2, 3],
  whys: [ "Después de la preposición «for» el verbo va en gerundio: thanks for agreeing.",
          "«Water» aquí es verbo: regar. El «too much» pide la acción, no el sustantivo.",
          "«Don't worry» es la fórmula fija para tranquilizar.",
          "«I've left» en present perfect: la llave sigue ahí ahora.",
          "«Run into trouble» es la collocation fija para toparse con un problema." ] },

{ intro: "Completa la nota con las palabras del banco. Sobran tres.",
  text: "Dear neighbours,\n\nThe lift will be out of [1] from Monday to Thursday while the cables are replaced. We are sorry for the [2] this will cause. If you have difficulty with the stairs, please get in [3] with the caretaker and we will make arrangements. The work should be [4] by Friday morning. Thank you for your [5] .\n\nThe management",
  bank: ["service", "inconvenience", "touch", "finished", "patience", "order", "contact", "trouble"],
  answers: [0, 1, 2, 3, 4],
  whys: [ "«Out of service» es la expresión fija para un aparato que no funciona.",
          "«Inconvenience» es la palabra formal de las disculpas oficiales: sorry for the inconvenience.",
          "«Get in touch with» es la collocation fija. Contact no lleva «in».",
          "«Should be finished» necesita participio porque la estructura es pasiva.",
          "«Thank you for your patience» es la fórmula de cierre habitual en estos avisos." ] },
],

/* ================================================================
   READING 2 · Ordenar el texto (la primera frase va dada)
   ================================================================ */
r2: [
{ intro: "Ordena el correo. La primera frase ya está colocada.",
  lines: [
    "Hi Dani, you won't believe what happened at the market on Saturday.",
    "I got there early because I wanted to find a present for my sister.",
    "While I was looking at some old records, a man asked me if I knew anything about them.",
    "It turned out he had been collecting the same music for thirty years.",
    "In the end he sold me two albums for the price of one.",
    "So now I have the perfect present and a new friend at the market."
  ],
  whys: [ "La frase dada abre anunciando que pasó algo.",
          "Explica primero por qué estaba allí: el motivo va antes que la escena.",
          "«While I was looking» sitúa la escena donde aparece el hombre.",
          "«It turned out» desarrolla quién era ese hombre recién mencionado.",
          "«In the end» marca el desenlace de la conversación.",
          "«So now» cierra con la consecuencia presente." ] },

{ intro: "Ordena el texto. La primera frase ya está colocada.",
  lines: [
    "Our village library was going to close last year because of budget cuts.",
    "When the news came out, a group of neighbours decided to do something about it.",
    "They organised a meeting in the square and over a hundred people turned up.",
    "Together they agreed to run the library themselves, with volunteers covering the afternoons.",
    "Since then the number of visitors has actually gone up.",
    "What began as a problem has ended up bringing the village closer together."
  ],
  whys: [ "La frase dada plantea el problema de partida.",
          "«When the news came out» reacciona directamente a ese anuncio.",
          "«They» son los vecinos del paso anterior; la reunión es su primera acción.",
          "«Together they agreed» es lo que se decide en esa reunión.",
          "«Since then» mira al resultado posterior.",
          "«What began as a problem» cierra resumiendo todo el recorrido." ] },
],

/* ================================================================
   READING 3 · Huecos con tres opciones (texto de opinión)
   ================================================================ */
r3: [
{ intro: "Elige la opción correcta para cada hueco.",
  text: "Everyone seems to agree that we should repair things instead of throwing them away, but very few of us actually [1] it. Part of the problem is that modern appliances are not [2] to be opened: the screws are hidden and the parts are glued. [3] , a growing number of volunteers now run 'repair cafés' where anyone can bring a broken toaster and learn to fix it. The idea is not only to save money [4] to break the habit of replacing everything. Those who have tried it say the hardest part is simply [5] that a repair is possible at all.",
  gaps: [
    { opts: ["do", "make", "take"], correct: 0, why: "«Do it» retoma la acción entera mencionada antes. Make it significaría lograrlo." },
    { opts: ["thought", "designed", "built"], correct: 1, why: "«Designed to be opened» es la collocation natural para hablar de la intención de un diseño." },
    { opts: ["Therefore", "However", "Moreover"], correct: 1, why: "La frase se opone al problema anterior, así que hace falta contraste." },
    { opts: ["but", "and", "or"], correct: 0, why: "Es la estructura fija not only… but also: la segunda mitad la introduce but." },
    { opts: ["believing", "to believe", "believed"], correct: 0, why: "Después de «is» como sujeto de la frase, el verbo va en gerundio: the hardest part is believing." }
  ] },

{ intro: "Elige la opción correcta para cada hueco.",
  text: "For years the council [1] that the only way to reduce traffic was to build more roads. The new figures suggest the [2] . Since the city centre was closed to cars, journey times have fallen and local shops report [3] more customers, not fewer. Critics had warned that businesses would suffer, but that fear has not been [4] out. What nobody expected was the effect on noise: residents say the streets are now quiet [5] to leave the windows open at night.",
  gaps: [
    { opts: ["assumed", "assured", "asserted"], correct: 0, why: "Assume es dar por supuesto. Assure es asegurar a alguien, y necesitaría un objeto de persona." },
    { opts: ["contrary", "opposite", "reverse"], correct: 1, why: "«The opposite» es lo que se usa para decir justo lo contrario. On the contrary lleva preposición." },
    { opts: ["having", "to have", "have"], correct: 0, why: "Report va seguido de gerundio: report having more customers." },
    { opts: ["borne", "taken", "held"], correct: 0, why: "«Bear out» es confirmar una previsión; en pasiva queda has not been borne out." },
    { opts: ["so", "too", "enough"], correct: 2, why: "Enough va detrás del adjetivo: quiet enough to leave the windows open." }
  ] },
],

/* ================================================================
   READING 4 · Emparejar titulares (5 párrafos, 6 titulares)
   ================================================================ */
r4: [
{ intro: "Empareja cada párrafo con su titular. Sobra uno.",
  items: [
    { label: "A", text: "When the last bakery shut, people assumed the village had lost its centre for good. Instead, three families put their savings together and reopened it as a shop, a café and a parcel point all in one." },
    { label: "B", text: "The building work was supposed to take four months. Two years later the scaffolding is still up, and nobody from the company will say when it might come down." },
    { label: "C", text: "Most visitors come for the beach, but the real surprise is inland: a network of paths that once carried mules now carries walkers, and hardly anyone uses them." },
    { label: "D", text: "Learning an instrument as an adult is slower, and there is no getting around that. What adults have instead is patience, and teachers say that matters more in the long run." },
    { label: "E", text: "The council spent a fortune on the new car park. Six months on, it stands almost empty while cars still circle the old square looking for a space." }
  ],
  options: [ "One shop replaces many", "A project with no end in sight", "The part nobody visits", "Slower, but not worse", "Money spent in the wrong place", "A tradition that came back unchanged" ],
  answers: [0, 1, 2, 3, 4],
  whys: [ "El párrafo cuenta que un local reúne tres funciones: es «one shop replaces many».",
          "Dos años y sin fecha de fin: un proyecto que no se acaba.",
          "El contraste es playa frente a interior: la parte que nadie visita.",
          "Reconoce que es más lento pero defiende la ventaja del adulto.",
          "El aparcamiento vacío mientras los coches dan vueltas: dinero mal gastado." ] },
],

/* ================================================================
   LISTENING 1 · Audios cortos, una pregunta cada uno
   ================================================================ */
l1: [
{ intro: "Escucha cada audio y responde. Puedes escucharlo dos veces.",
  questions: [
    { script: "I'd booked the eight o'clock train, but there was a problem on the line, so they put us all on a coach. We still got in on time, which surprised me.",
      q: "How did the speaker finally travel?", opts: ["By train", "By coach", "By car", "By plane"], correct: 1,
      why: "Dice «they put us all on a coach»: acabó viajando en autocar, aunque había reservado tren." },
    { script: "The flat itself is lovely, honestly. It's just that the bus into town takes forty minutes, and there's nothing much within walking distance.",
      q: "What is the speaker's main complaint?", opts: ["The flat is small", "The rent is high", "It is badly connected", "The neighbours are noisy"], correct: 2,
      why: "Elogia el piso y solo se queja del transporte y de que no hay nada cerca." },
    { script: "Don't worry about bringing anything. Well — if you really want to, a bottle of something would be nice, but there'll be plenty of food.",
      q: "What does the speaker suggest?", opts: ["Bringing a dish", "Bringing a drink", "Bringing nothing at all", "Arriving early"], correct: 1,
      why: "«A bottle of something» apunta a una bebida; la comida dice que ya está cubierta." }
  ] },
],

/* ================================================================
   LISTENING 2 · Cuatro hablantes, cinco frases (una sobra)
   ================================================================ */
l2: [
{ intro: "Escucha a los cuatro hablantes y empareja cada uno con la frase que le corresponde. Sobra una.",
  items: [
    { label: "Speaker 1", script: "I signed up thinking it would help me relax. It does, but what I didn't expect was the people. Half the class now goes for coffee afterwards." },
    { label: "Speaker 2", script: "I gave it up after a month. It wasn't the exercise, it was the time: getting there and back took longer than the class itself." },
    { label: "Speaker 3", script: "I'm still terrible at it, and I've been going for two years. But I turn up every week, and that's more than I can say for most things I've started." },
    { label: "Speaker 4", script: "My doctor suggested it, so I went along expecting to hate it. I still wouldn't call it fun, but my back is much better." }
  ],
  options: [ "Values the social side more than expected", "Stopped because of the travelling", "Is proud of keeping it up despite not improving", "Does it for health reasons rather than pleasure", "Found it too expensive to continue" ],
  answers: [0, 1, 2, 3],
  whys: [ "Lo inesperado fue la gente y el café posterior: lo social.",
          "Lo dejó por el tiempo de desplazamiento, no por el ejercicio.",
          "Sigue siendo malo pero valora su propia constancia.",
          "Fue por recomendación médica y no le divierte: motivo de salud." ] },
],

/* ================================================================
   LISTENING 3 · ¿Quién lo dice? (él, ella o los dos)
   ================================================================ */
l3: [
{ intro: "Escucha la conversación y decide de quién es cada idea.",
  script: "Ben: Honestly, I think working from home has made me lazier. I get the work done, but I've stopped going out at all. Clara: That's interesting, because for me it's the opposite — I walk every lunchtime now, which I never did at the office. Ben: I'll give you that the commute was dead time. Two hours a day I'll never get back. Clara: Exactly. And I don't miss it for a second. Ben: What I do miss is bumping into people. You can't replace that with a video call. Clara: No, you can't. That's the one thing I'd change.",
  items: [
    { label: "1", text: "Says the daily commute was wasted time." },
    { label: "2", text: "Has become less active since working from home." },
    { label: "3", text: "Misses unplanned contact with colleagues." },
    { label: "4", text: "Takes more exercise now than before." }
  ],
  options: ["Ben", "Clara", "Los dos"],
  answers: [2, 0, 2, 1],
  whys: [ "Ben lo llama «dead time» y Clara responde «Exactly»: coinciden los dos.",
          "Solo Ben dice que se ha vuelto más perezoso y ha dejado de salir.",
          "Ben lo dice y Clara lo confirma: «No, you can't». Los dos.",
          "Solo Clara camina cada mediodía, algo que antes no hacía." ] },
],

/* ================================================================
   LISTENING 4 · Monólogo largo (idea principal y actitud)
   ================================================================ */
l4: [
{ intro: "Escucha la charla y responde a las preguntas.",
  script: "When people ask me what changed the library, they expect me to say the computers. It wasn't. We put the computers in years ago and hardly anyone came. What changed everything was taking out half the shelves. That sounds like the opposite of what a library should do, and the council certainly thought so. But the space we freed up became a place where people could simply sit — with a coffee, with a pushchair, with a laptop. Borrowing went up, which nobody predicted, because it turns out that people who stay for an hour tend to leave with a book. I'm not saying every library should do this. What I am saying is that we spent twenty years asking how to get people to read, when the question was how to get them through the door.",
  questions: [
    { q: "What does the speaker say made the real difference?", opts: ["Installing computers", "Removing shelves to create space", "Buying more books", "Opening longer hours"], correct: 1,
      why: "Dice explícitamente que no fueron los ordenadores: «What changed everything was taking out half the shelves»." },
    { q: "What was the council's reaction to the idea?", opts: ["They suggested it", "They approved immediately", "They doubted it", "They refused to fund it"], correct: 2,
      why: "«The council certainly thought so» se refiere a que parecía lo contrario de lo que debe hacer una biblioteca: dudaron." },
    { q: "What is the speaker's attitude at the end?", opts: ["Every library should copy them", "The question itself was wrong for years", "Reading matters less than before", "The project was a failure"], correct: 1,
      why: "Aclara que no propone copiarlo; su conclusión es que llevaban veinte años haciéndose la pregunta equivocada." }
  ] },
],

/* ================================================================
   WRITING · Sin modelo detrás no hay corrección automática, así que
   cada tarea trae respuesta modelo de B2 y lista de comprobación.
   ================================================================ */
w1: [
{ intro: "Te apuntas a un club de fotografía. Responde con 1-5 palabras por casilla.",
  context: "Riverside Photography Club — membership form.",
  fields: [
    { prompt: "What is your name?", words: "1-5 palabras" },
    { prompt: "How did you hear about the club?", words: "1-5 palabras" },
    { prompt: "What kind of photography interests you?", words: "1-5 palabras" },
    { prompt: "How often would you like to attend?", words: "1-5 palabras" },
    { prompt: "Do you have your own camera?", words: "1-5 palabras" }
  ],
  model: [ "Alejandro González.", "Through a friend.", "Landscape and street photography.", "Twice a month.", "Yes, a second-hand one." ],
  check: [ "¿Has respondido a lo que se pregunta, sin irte por las ramas?",
           "¿Te has mantenido dentro de 1-5 palabras? Pasarse penaliza.",
           "¿Empiezan por mayúscula y acaban en punto?",
           "Aquí no hacen falta frases completas, pero sí que la respuesta encaje con la pregunta." ] },
],

w2: [
{ intro: "Ahora escribe 20-30 palabras, en frases completas.",
  context: "Riverside Photography Club — tell us a little more about you.",
  fields: [ { prompt: "Why do you want to join the club, and what do you hope to learn?", words: "20-30 palabras" } ],
  model: [ "I have taken photos for years but never shown them to anyone. I would like to learn how to use light properly and to get honest feedback on my work." ],
  check: [ "¿Estás entre 20 y 30 palabras? Cuéntalas: salirse baja la nota.",
           "¿Has respondido a las DOS partes: por qué te apuntas y qué esperas aprender?",
           "¿Has usado frases completas con sujeto y verbo, no una lista?",
           "¿Hay algún conector (because, so, and then) que una las ideas?" ] },
],

w3: [
{ intro: "Tres socios del club te escriben en el chat. Responde a cada uno con 30-40 palabras, en tono informal.",
  context: "You have joined the club's group chat.",
  fields: [
    { prompt: "Marta: Welcome! Tell us, what was the first photo you were ever proud of?", words: "30-40 palabras" },
    { prompt: "Tom: We're planning a walk next month. Morning or afternoon — what works better for you?", words: "30-40 palabras" },
    { prompt: "Aisha: Some of us want to do a small exhibition. Would you put anything in?", words: "30-40 palabras" }
  ],
  model: [
    "Thanks! It was a photo of my grandmother in her kitchen, taken about ten years ago. Nothing technical about it, but the light was perfect and she looked completely herself.",
    "Morning would suit me much better, if that's all right with the rest of you. I'm usually free before midday at weekends, and honestly the light is far nicer then anyway.",
    "I'd love to, although I'm a bit nervous about showing my work. I have a few street photos from last summer that might work well. Could I show them to you first?"
  ],
  check: [ "¿Cada respuesta está entre 30 y 40 palabras?",
           "¿Suena a chat entre amigos? Contracciones (I'd, that's) sí; «I would be grateful» no.",
           "¿Has respondido de verdad a la pregunta concreta de cada uno?",
           "¿Has añadido algo propio — un detalle, una pregunta de vuelta — o solo has contestado seco?" ] },
],

w4: [
{ intro: "Dos textos con registros distintos. Es la parte que más pesa de todo el Writing.",
  context: "The club has announced that the monthly fee will double from next month, and that the Saturday sessions will be cancelled.",
  fields: [
    { prompt: "Write to your friend Marta, who is also a member. Tell her how you feel about the news. (Informal)", words: "40-50 palabras" },
    { prompt: "Write to the club manager. Explain your concerns and ask what alternatives there are. (Formal)", words: "120-150 palabras" }
  ],
  model: [
    "Hi Marta, have you seen the email? I can't believe they're doubling the fee and scrapping the Saturday sessions at the same time. Saturday was the only day I could make. I'm going to write to them — are you up for doing the same?",
    "Dear Sir or Madam,\n\nI am writing regarding the changes announced last week, which I understand will take effect next month.\n\nWhile I appreciate that costs have risen, I am concerned that doubling the membership fee and cancelling the Saturday sessions at the same time will affect many members. In my own case, Saturday was the only day I was able to attend, so the change effectively ends my membership despite the higher fee.\n\nI would be grateful if you could tell me whether any alternatives have been considered, such as a reduced rate for members who attend less often, or moving the Saturday session to another weekend slot.\n\nI look forward to hearing from you.\n\nYours faithfully,\nAlejandro González"
  ],
  check: [ "¿El informal está entre 40 y 50 palabras y el formal entre 120 y 150? Cuéntalos.",
           "¿Se nota la diferencia de registro? El informal con contracciones; el formal sin ellas y sin phrasal verbs coloquiales.",
           "En el formal: ¿has abierto con «Dear Sir or Madam» y cerrado con «Yours faithfully»? (Si sabes el nombre: Dear Mr/Ms X … Yours sincerely.)",
           "¿El formal cubre las dos cosas que piden: explicar tu preocupación Y preguntar por alternativas?",
           "¿Has usado párrafos separados en el formal? Un bloque único baja la cohesión.",
           "Reserva la mitad del tiempo del Writing para esta parte: es la que más puntúa." ] },
],

/* ================================================================
   SPEAKING · Igual que Writing: respuesta modelo y comprobación.
   ================================================================ */
s1: [
{ intro: "Tres preguntas personales, 30 segundos cada una, sin preparación.",
  prep: 0,
  rounds: [
    { prompt: "Tell me about the area where you live.", seconds: 30 },
    { prompt: "What do you usually do at the weekend?", seconds: 30 },
    { prompt: "Do you prefer to spend your free time indoors or outdoors? Why?", seconds: 30 }
  ],
  useful: [ "I'd say…", "What I like most is…", "It depends, really, but generally…" ],
  model: [
    "I live in a fairly quiet neighbourhood on the edge of the city. There's a small market on Saturdays and a park nearby, which is where I usually go. It's not exciting, but it suits me.",
    "It varies. I try to get out of the city if I can, even just for a walk. Otherwise I catch up with friends, do the shopping, and spend far too long cooking something complicated.",
    "Outdoors, definitely — though I should say it depends on the weather. Being outside clears my head after a week at a desk, and I sleep much better when I've walked a lot."
  ],
  check: [ "¿Has hablado los 30 segundos enteros? El silencio penaliza más que un error.",
           "¿Has dado un motivo o un ejemplo, en vez de una respuesta de una frase?",
           "¿Has usado alguna de las expresiones de arriba para ganar tiempo sin callarte?" ] },
],

s2: [
{ intro: "Describe la escena y responde a dos preguntas. 45 segundos cada una.",
  scene: "Picture: an outdoor market on a grey morning. A woman is arranging boxes of vegetables on a stall. Two customers wait beside her, one holding an umbrella. In the background a man is unloading crates from a small van.",
  prep: 0,
  rounds: [
    { prompt: "Describe the picture.", seconds: 45 },
    { prompt: "Do you like shopping at markets? Why or why not?", seconds: 45 },
    { prompt: "How are markets different from supermarkets in your country?", seconds: 45 }
  ],
  useful: [ "In the foreground / In the background…", "It looks as if…", "Judging by the…" ],
  model: [
    "This is an outdoor market, and it looks like early morning because the light is grey and the stalls are still being set up. In the foreground a woman is arranging boxes of vegetables. Two customers are waiting beside her, and one of them is holding an umbrella, so it has probably been raining.",
    "I do, though not as often as I'd like. What I enjoy is being able to ask where things come from, which you can't really do in a supermarket. The downside is that markets take time, and on a weekday I simply don't have it.",
    "The main difference is the pace. In a supermarket you go in with a list and you're out in ten minutes. At a market you queue, you chat, and you end up buying whatever looks good that day. Markets also tend to be cheaper for fruit and vegetables."
  ],
  check: [ "En la descripción, ¿has situado las cosas (in the foreground, behind her) en vez de enumerarlas sueltas?",
           "¿Has usado present continuous para lo que está pasando: she is arranging, they are waiting?",
           "¿Has deducido algo de la imagen («it looks as if it has been raining») en vez de solo listar objetos?",
           "¿Has llegado a los 45 segundos en las tres?" ] },
],

s3: [
{ intro: "Compara las dos escenas y responde a dos preguntas. 45 segundos cada una.",
  scene: "Picture A: a family eating together at a kitchen table, dishes in the middle, everyone talking. / Picture B: a young man eating alone at a desk, looking at a screen, a box of takeaway food beside the keyboard.",
  prep: 0,
  rounds: [
    { prompt: "Compare the two pictures.", seconds: 45 },
    { prompt: "Which situation is more common where you live? Why?", seconds: 45 },
    { prompt: "Does it matter who we eat with? Why or why not?", seconds: 45 }
  ],
  useful: [ "Whereas in the second picture…", "The most obvious difference is…", "Both of them show…, but…" ],
  model: [
    "Both pictures show someone eating, but the situations couldn't be more different. In the first, a whole family is sitting round a table sharing dishes and talking, whereas in the second a young man is eating alone at his desk, straight from a takeaway box, with his eyes on a screen.",
    "Honestly, both are common, but I'd say the second is winning. People work longer hours and eat at their desks during the week. The family meal still happens, but it has moved to the weekend rather than every evening.",
    "I think it does, though not for the reason people usually give. It's less about the food and more about stopping. When you eat alone at a screen you don't really notice you've eaten, whereas a meal with other people forces you to take a proper break."
  ],
  check: [ "¿Has COMPARADO de verdad, con whereas o while, en vez de describir una y luego la otra por separado?",
           "¿Has dado tu opinión con un motivo en las dos últimas?",
           "¿Has evitado quedarte callado? Si te bloqueas, repite la idea con otras palabras y sigue." ] },
],

s4: [
{ intro: "Un minuto de preparación y dos minutos para las tres preguntas seguidas. Apunta palabras clave, no frases.",
  scene: "Picture: an almost empty village street with several shuttered shopfronts; a single elderly man walks along the pavement.",
  prep: 60,
  questions3: [
    "Describe what you can see in the picture.",
    "Why do you think young people leave villages like this one?",
    "What could be done to bring people back to small towns?"
  ],
  rounds: [ { prompt: "Answer the three questions.", seconds: 120 } ],
  useful: [ "As I see it…", "There are two reasons for this. Firstly…", "To sum up, I'd say…" ],
  model: [
    "The picture shows a village street that is almost empty. Several shops have their shutters down, which suggests they have closed for good rather than just for the afternoon, and the only person visible is an elderly man walking alone.\n\nAs for why young people leave, I think there are two main reasons. Firstly, the work simply isn't there — if the shops have closed, so have the jobs. Secondly, and this matters more than people admit, there is nothing to do. Young people want somewhere to meet, and an empty street doesn't offer that.\n\nAs for what could be done, I'm not convinced that grants alone work. What seems to help is bringing back a reason to be there: a school, decent internet so people can work remotely, and transport that doesn't stop at six. To sum up, I'd say you have to give people a life, not just a house."
  ],
  check: [ "¿Has usado el minuto de preparación para apuntar palabras sueltas, no frases enteras?",
           "¿Has respondido a las TRES preguntas? Dejarse una es lo que más baja la nota aquí.",
           "¿Has marcado la estructura en voz alta (firstly, secondly, to sum up)? Es lo que separa un B1 de un B2.",
           "¿Has llegado a los dos minutos? Es la parte más larga y la que más cuesta sostener." ] },
],
};
