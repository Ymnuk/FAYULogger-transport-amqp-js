'use strict'

const amqplib = require('amqplib');
const FAYULogger = require('fayulogger');

/**
 * Класс-сервер для приема сообщений логов из MQ и направление их в логгер на стороне сервера для распределения в других транспорт и дальнейшей обработки
 */
class Receiver {
    /**
     * Конструктор класса для получения событий из MQ
     * @param {String} name Название модуля логирования
     * @param {Object} options Параметры
     */
    constructor(name, options) {
        this.__logger = new FAYULogger();
        //Подключение
        this.__connection = null;
        //Канал
        this.__channel = null;
        //Обменник
        this.__exchange = null;
        
        this.__hostname = options && options.hostname ? options.hostname : 'localhost';//Адрес сервера
		this.__port = options && options.port ? options.port : 5672;//Порт сервера
		this.__username = options && options.username ? options.username : 'guest';//Логин подключения
		this.__password = options && options.password ? options.password : 'guest';//Пароль подключения
		this.__heartbeat = options && options.heartbeat ? options.heartbeat : 30;//Проверка соединения
		this.__frameMax = options && options.frameMax ? options.frameMax : 0;//Размер фрейма
		this.__locale = options && options.locale ? options.locale : 'en_US';//Язык по умолчанию
		this.__vhost = options && options.vhost ? options.vhost : '/';//Путь до экземпляра
        //this.__queueName = options && options.queue ? options.queue : `server-rpc-${uuid()}`;//Название очереди сервера
        this.__exchangeName = options && options.exchange ? options.exchange : 'logs';//Обменник для логов
        this.__queuePrefix = options && options.queuePrefix ? oprions.queuePrefix : 'logs_';//Префик имен очередей для логов
		this.__prefetch = options && options.prefetch && typeof(options.prefetch) == 'number' ? options.prefetch : 3;
		this.__reconnect = options && options.reconnect && typeof(options.reconnect) == 'boolean' ? options.reconnect : false;//Переподключаться, если был разрыв соединения
    }

    /**
     * Вернуть логгер
     */
    get logger() {
        return this.__logger;
    }

    /**
     * Закрытие и отключение
     */
    close() {
        this.__stop();
        logger.close();
    }

    /**
     * Подключение к MQ и установка привязок к очередям
     */
    async connect() {
        //Создание подключения
        try {
            this.__connection = await amqplib.connect({
                protocol: 'amqp',
				hostname: this.__hostname,
				port: this.__port,
				username: this.__username,
				password: this.__password,
				locale: this.__locale,
				frameMax: this.__frameMax,
				heartbeat: this.__heartbeat,
				vhost: this.__vhost
            })
        } catch(e) {
            await this.__stop();
            throw e;
        }
        //Подключение к каналу
        try {
			this.__channel = await this.__connection.createChannel();
			this.__channel.prefetch(this.__prefetch);
			this.__channel.on('close', () => {
				//TODO если канал закрыт
			});
			this.__channel.on('error', (err) => {
				console.error(err);
				//TODO если получена ошибка канала
			});
			this.__channel.on('return', (msg) => {
				//console.log(msg.content);
				//TODO если возвращено сообщение, которое не удалось отправить в очередь
			});
			this.__channel.on('drain', () => {
				//TODO Like a stream.Writable, a channel will emit 'drain', if it has previously returned false from #publish or #sendToQueue, once its write buffer has been emptied (i.e., once it is ready for writes again).
			});
		}catch(e){
			await this.__stop();
			throw e;
        }
        //Назначение обменника
        try {
            this.__channel.assertExchange(this.__exchangeName, 'direct', {durable: false});
        } catch(e) {
            await this.__stop();
            throw e;
        }
        //Назначение очередей для роутинга из обменника
        //debug
        await this.__channel.assertQueue(`${this.__queuePrefix}debug`, {
            autoDelete: false,
            durable: true
        });
        this.__channel.bindQueue(`${this.__queuePrefix}debug`, this.__exchangeName, 'debug')
        this.__channel.consume(`${this.__queuePrefix}debug`, (msg) => {
            this.__onDebug(msg);
        }, {
            durable: false
        })
        //Info
        await this.__channel.assertQueue(`${this.__queuePrefix}info`, {
            autoDelete: false,
            durable: true
        });
        this.__channel.bindQueue(`${this.__queuePrefix}info`, this.__exchangeName, 'info')
        this.__channel.consume(`${this.__queuePrefix}info`, (msg) => {
            this.__onInfo(msg);
        }, {
            durable: false
        })
        //Warn
        await this.__channel.assertQueue(`${this.__queuePrefix}warn`, {
            autoDelete: false,
            durable: true
        });
        this.__channel.bindQueue(`${this.__queuePrefix}warn`, this.__exchangeName, 'warn')
        this.__channel.consume(`${this.__queuePrefix}warn`, (msg) => {
            this.__onWarn(msg);
        }, {
            durable: false
        })
        //Severe
        await this.__channel.assertQueue(`${this.__queuePrefix}severe`, {
            autoDelete: false,
            durable: true
        });
        this.__channel.bindQueue(`${this.__queuePrefix}severe`, this.__exchangeName, 'severe')
        this.__channel.consume(`${this.__queuePrefix}severe`, (msg) => {
            this.__onSevere(msg);
        }, {
            durable: false
        })
        //Error
        await this.__channel.assertQueue(`${this.__queuePrefix}error`, {
            autoDelete: false,
            durable: true
        });
        this.__channel.bindQueue(`${this.__queuePrefix}error`, this.__exchangeName, 'error')
        this.__channel.consume(`${this.__queuePrefix}error`, (msg) => {
            this.__onError(msg);
        }, {
            durable: false
        })
        //Fatal
        await this.__channel.assertQueue(`${this.__queuePrefix}fatal`, {
            autoDelete: false,
            durable: true
        });
        this.__channel.bindQueue(`${this.__queuePrefix}fatal`, this.__exchangeName, 'fatal')
        this.__channel.bindQueue(`${this.__queuePrefix}fatal`, (msg) => {
            this.__onFatal(msg);
        }, {
            durable: false
        })
    }

    /**
     * Событие DEBUG
     * @param {Object} msg Сообщение
     */
    __onDebug(msg) {
        for(let i = 0; i < this.logger.modules.length; i++) {
            this.logger.modules[i].debug(msg);
        }
    }

    /**
     * Событие INFO
     * @param {Object} msg Сообщение
     */
    __onInfo(msg) {
        for(let i = 0; i < this.logger.modules.length; i++) {
            this.logger.modules[i].info(msg);
        }
    }

    /**
     * Событие WARN
     * @param {Object} msg Сообщение
     */
    __onWarn(msg) {
        for(let i = 0; i < this.logger.modules.length; i++) {
            this.logger.modules[i].warn(msg);
        }
    }

    /**
     * Событие SEVERE
     * @param {Object} msg Сообщение
     */
    __onSevere(msg) {
        for(let i = 0; i < this.logger.modules.length; i++) {
            this.logger.modules[i].severe(msg);
        }
    }

    /**
     * Событие ERROR
     * @param {Object} msg Сообщение
     */
    __onError(msg) {
        for(let i = 0; i < this.logger.modules.length; i++) {
            this.logger.modules[i].error(msg);
        }
    }

    /**
     * Событие FATAL
     * @param {Object} msg Сообщение
     */
    __onFatal(msg) {
        for(let i = 0; i < this.logger.modules.length; i++) {
            this.logger.modules[i].fatal(msg);
        }
    }

    /**
     * Отключение от MQ
     */
    async __stop() {
        this.__channel = null;
        try {
            if(this.__connection != null) {
                this.__connection.close();
            }
        } finally {
            this.__connection = null;
        }
    }

}

module.exports = Receiver;