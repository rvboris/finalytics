import React from 'react';
import { connect } from 'react-redux';
import { createSelector } from 'reselect';
import { reduxForm, Field, SubmissionError } from 'redux-form';
import { mapValues, get } from 'lodash';
import { defineMessages, injectIntl, FormattedMessage } from 'react-intl';
import FaFacebookIcon from 'react-icons/lib/fa/facebook';
import FaGoogleIcon from 'react-icons/lib/fa/google';
import FaTwitterIcon from 'react-icons/lib/fa/twitter';
import {
  Button,
  ButtonGroup,
  Form,
  FormGroup,
  FormFeedback,
  Label,
  Input,
  Alert,
  Card,
  CardHeader,
  CardBlock,
} from 'reactstrap';

import validationHandler from '../../utils/validation-handler';
import style from './style.css';

const messages = defineMessages({
  title: {
    id: 'auth.login.title',
    description: 'Login dialog title',
    defaultMessage: 'Login',
  },
  email: {
    placeholder: {
      id: 'auth.login.email.placeholder',
      description: 'Login dialog email hint',
      defaultMessage: 'example@domain.com',
    },
    label: {
      id: 'auth.login.email.label',
      description: 'Login dialog email float hint',
      defaultMessage: 'Enter your email',
    },
  },
  password: {
    placeholder: {
      id: 'auth.login.password.placeholder',
      description: 'Login dialog password hint',
      defaultMessage: 'strong password',
    },
    label: {
      id: 'auth.login.password.label',
      description: 'Login dialog password float hint',
      defaultMessage: 'Enter your password',
    },
  },
  button: {
    id: 'auth.login.button',
    description: 'Login dialog submit button label',
    defaultMessage: 'Login',
  },
  processButton: {
    id: 'auth.login.processButton',
    description: 'Login dialog submit button label in process state',
    defaultMessage: 'Please wait...',
  },
  registerButton: {
    id: 'auth.login.registerButton',
    description: 'Login dialog register button label',
    defaultMessage: 'Registration',
  },
});

const onGoogle = () => {
  window.location.pathname = '/api/auth/google';
};

const onFacebook = () => {
  window.location.pathname = '/api/auth/facebook';
};

const onTwitter = () => {
  window.location.pathname = '/api/auth/twitter';
};

const FormField = (field) =>
  <FormGroup color={field.meta.error ? 'danger' : null}>
    <Label>{field.label}</Label>
    <Input
      type={field.type}
      placeholder={field.placeholder}
      {...field.input}
    />
    {field.meta.touched && field.meta.error && <FormFeedback>{field.meta.error}</FormFeedback>}
  </FormGroup>;

let LoginForm = (props) => {
  const {
    form: { error, handleSubmit, pristine, submitting },
    intl: { formatMessage },
    process,
    login,
    go,
    onSuccess,
    onError,
  } = props;

  const defaultValues = { email: null, password: null };

  const onRegister = () => go('/register');

  const submitHandler = (values) =>
    new Promise(async (resolve, reject) => {
      let result;

      const toValidate = Object.assign({}, defaultValues, values);

      try {
        result = await login(toValidate);
      } catch (err) {
        const validationResult =
          mapValues(validationHandler(toValidate, err), (val) => formatMessage({ id: val }));

        reject(new SubmissionError(validationResult));
        return;
      }

      resolve(get(result, 'data.token'));
    }).then(onSuccess, onError);

  return (
    <div className={style.container}>
      <Card className={style.form}>
        <CardHeader><FormattedMessage {...messages.title} /></CardHeader>

        <CardBlock>
          <Form onSubmit={handleSubmit(submitHandler)} noValidate>
            <Field
              name="email"
              label={formatMessage(messages.email.label)}
              placeholder={formatMessage(messages.email.placeholder)}
              component={FormField}
              type="email"
            />

            <Field
              name="password"
              label={formatMessage(messages.password.label)}
              placeholder={formatMessage(messages.password.placeholder)}
              component={FormField}
              type="password"
            />

            { error && <Alert color="danger">{error}</Alert> }

            <div className={style.buttons}>
              <Button
                type="button"
                disabled={process}
                onClick={onRegister}
              >
                <FormattedMessage {...messages.registerButton} />
              </Button>
              <Button
                type="submit"
                color="primary"
                disabled={pristine || submitting || process}
              >{process
                ? <FormattedMessage {...messages.processButton} />
                : <FormattedMessage {...messages.button} />
              }</Button>
            </div>
          </Form>

          <ButtonGroup className="btn-group-justified">
            <Button type="button" onClick={onGoogle}>
              <FaGoogleIcon size={30} />
            </Button>

            <Button type="button" onClick={onFacebook}>
              <FaFacebookIcon size={30} />
            </Button>

            <Button type="button" onClick={onTwitter}>
              <FaTwitterIcon size={30} />
            </Button>
          </ButtonGroup>
        </CardBlock>
      </Card>
    </div>
  );
};

LoginForm.propTypes = {
  form: React.PropTypes.object.isRequired,
  intl: React.PropTypes.object.isRequired,
  process: React.PropTypes.bool.isRequired,
  login: React.PropTypes.func.isRequired,
  go: React.PropTypes.func.isRequired,
  onSuccess: React.PropTypes.func,
  onError: React.PropTypes.func,
};

const selector = createSelector(
  state => get(state, 'auth.process', false),
  process => ({ process })
);

LoginForm = reduxForm({ form: 'login', propNamespace: 'form' })(LoginForm);
LoginForm = connect(selector)(LoginForm);

export default injectIntl(LoginForm);
