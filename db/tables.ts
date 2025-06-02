export const betResult = `create table if not exists bet_results (
    id int auto_increment primary key,
    user_id varchar(50),
    match_id varchar(100),
    operator_id varchar(50),
    bet_amt float,
    bet_values json,
    team_info json,
    created_at timestamp default current_timestamp,
    updated_at timestamp default current_timestamp on update current_timestamp
);`

export const settlement = `create table if not exists settlements (
    id int auto_increment primary key,
    user_id varchar(50),
    match_id varchar(100),
    operator_id varchar(50),
    bet_amt float,
    win_amt float,
    bet_values json,
    win_result json,
    status enum("WIN", "LOSS", "TIE"),
    created_at timestamp default current_timestamp,
    updated_at timestamp default current_timestamp on update current_timestamp
);`

export const gameSettings = `CREATE TABLE IF NOT EXISTS game_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    settings JSON NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);`