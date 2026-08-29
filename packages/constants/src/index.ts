export const MICROSERVICES = {
    USERS_SERVICE: 'USERS_SERVICE',
    AUTH_SERVICE: 'AUTH_SERVICE',
    PROBLEMS_SERVICE: 'PROBLEMS_SERVICE',
    TAGS_SERVICE: 'TAGS_SERVICE',
    COMPANIES_SERVICE: 'COMPANIES_SERVICE',
    SUBMISSIONS_SERVICE: 'SUBMISSIONS_SERVICE',
};

export const COOKIE_NAME = 'jid';

export const USERS = {
    FIND_ALL: 'users.findAll',
    CURRENT: 'users.current',
    FIND_ONE: 'users.findOne',
    UPDATE: 'users.update',
};

export const AUTH = {
    REGISTER: 'auth.register',
    CONFIRM_EMAIL: 'auth.confirmEmail',
    LOGIN: 'auth.login',
    LOGOUT: 'auth.logout',
    REFRESH_TOKEN: 'auth.refreshToken',
    FORGOT_PASSWORD: 'auth.forgotPassword',
    RESET_PASSWORD: 'auth.resetPassword',
};

export const PROBLEMS = {
    FIND_ALL: 'problems.findAll',
    FIND_ONE: 'problems.findOne',
    FIND_ONE_BY_ID: 'problems.findOneById',
    CREATE: 'problems.create',
    DELETE: 'problems.delete',
    UPDATE: 'problems.update',
};

export const TAGS = {
    FIND_ALL: 'tags.findAll',
    FIND_ONE: 'tags.findOne',
    CREATE: 'tags.create',
};

export const COMPANIES = {
    FIND_ALL: 'companies.findAll',
    FIND_ONE: 'companies.findOne',
    CREATE: 'companies.create',
};

export const SUBMISSIONS = {
    FIND_ALL: 'submissions.findAll',
    CREATE: 'submissions.create',
};

export const LANG_CONFIGS: Record<
    string,
    { image: string; compile?: string[]; run: string[]; defaultCode?: string }
> = {
    cpp: {
        image: 'gcc:latest',
        compile: ['g++', 'solution.cpp', '-o', 'solution'],
        run: ['./solution'],
        defaultCode: `#include <iostream>
using namespace std;

int main(){
    return 0;
}`,
    },
    python: {
        image: 'python:3.9',
        run: ['python3', 'solution.py'],
        defaultCode: '',
    },
    javascript: {
        image: 'node:18',
        run: ['node', 'solution.js'],
        defaultCode: '',
    },
    java: {
        image: 'eclipse-temurin:17-jdk',
        compile: ['javac', 'Solution.java'],
        run: ['java', 'Solution'],
        defaultCode: `public class Solution {
    public static void main(String[] args) {
        
    }
}`,
    },
};
