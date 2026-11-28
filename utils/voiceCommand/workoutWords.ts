import { tokenizeExerciseText } from '@/utils/exerciseSearch';

/**
 * Words that ask for a workout without naming one, in the ten bundled languages: the verbs, the
 * small words and "workout", "training", "session" and "day". Said alone they pick nothing, so
 * "start a workout" never means "Workout A". A word that could name a workout stays out, in every
 * language: "dos" is two in Spanish and the back in French.
 */
const GENERIC_WORDS: readonly string[] = [
  // English
  'a an the my me i im s to can you lets let go start started starting begin open do launch kick off up',
  'want would like please now today todays tonight this some for of on in it with hey ok okay',
  'workout workouts training session day routine exercise exercises gym',
  // German
  'ich will möchte mein meine meinen meinem meiner das die der den dem ein eine einen einem bitte',
  'jetzt heute heutige heutiges heutigen starte start starten beginne beginnen mach mache machen öffne los mit für zu am im und',
  'training trainings trainingseinheit einheit workout tag übung übungen',
  // Dutch
  'ik wil mijn mn m de het een nu vandaag alsjeblieft start starten begin beginnen open openen doe doen met voor van',
  'training trainen sessie dag routine oefening oefeningen',
  // Spanish
  'quiero vamos mi mis el la los las un una de del por favor ahora hoy empezar empieza empiezo inicia iniciar comienza comenzar abre abrir hacer haz entrenar con para a',
  'entrenamiento entreno sesión día rutina ejercicio ejercicios',
  // Portuguese
  'quero vamos meu minha meus minhas o a os as um uma do da de por favor agora hoje começar começa inicia iniciar abre abrir fazer faz com para pra',
  'treino treinar sessão dia rotina exercício exercícios',
  // French
  'je veux voudrais mon ma mes le la les l un une de du des d s il te plaît maintenant aujourd hui commence commencer démarre démarrer lance lancer ouvre ouvrir faire fais avec pour on y va allons',
  'entraînement séance jour routine exercice exercices',
  // Italian
  'voglio vorrei mio mia miei mie il lo la i gli le l un uno una di del della dell per favore ora adesso oggi inizia iniziare comincia cominciare avvia avviare apri aprire fare fai con andiamo',
  'allenamento allenare sessione giorno giornata scheda esercizio esercizi',
  // Polish
  'chcę mój moja moje mojego ten ta to na do z dla teraz dzisiaj dziś proszę zacznij zacząć rozpocznij rozpocząć uruchom włącz otwórz zrób zrobić',
  'trening treningi treningu sesja sesję sesje dzień rutyna ćwiczenie ćwiczenia',
  // Russian
  'я хочу мой моя моё мою моего это эту этот на в с для сейчас сегодня сегодняшнюю пожалуйста начать начни начинаем запусти запустить открой открыть сделать сделай давай поехали',
  'тренировка тренировку тренировки занятие день упражнение упражнения',
  // Turkish
  'benim bu bir şimdi bugün bugünkü lütfen başla başlat başlamak aç açmak yap yapmak istiyorum hadi',
  'antrenman antrenmanı antrenmanım antrenmanımı idman idmanı seans seansı gün günü günümü rutin egzersiz',
];

/** Tokenized as workout names and sentences are, so accents and plurals never disagree. */
export const GENERIC_WORKOUT_WORDS: ReadonlySet<string> = new Set(
  GENERIC_WORDS.flatMap(tokenizeExerciseText)
);
