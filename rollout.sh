#!/bin/bash

# Amazon S3 Buckets
s3TestBucket="pori.todo-cloud.com"
s3BetaBucket="beta.todo-cloud.com"
s3ProdBucket="app.todo-cloud.com"

# Amazon CloudFront Distributions
cfTestDistribution="E31BFVOVB8F7T4"
cfBetaDistribution="ESEFL638NPZGJ"

function chooseDeploymentType {
    echo ""
    echo "1. Internal Testing (pori.todo-cloud.com)"
    echo "2. Beta (beta.todo-cloud.com)"
    echo "3. Production (app.todo-cloud.com)"
    echo ""
    read -p "Select your deployment type (<Enter> to return to main menu): " -n 1 -s selectedOption
    echo ""

    if [ -z "$selectedOption" ]
    then
        deploymentType=""
        return
    fi
    case $selectedOption in
    1)
        deploymentType="TEST"
        ;;
    2)
        deploymentType="BETA"
        ;;
    3)
        deploymentType="PROD"
        ;;
    *)
        deploymentType=""
        ;;
    esac

    echo ""
    echo "Selected deployment type: $deploymentType"
}

function syncFiles {
    local distType=$1

    echo "syncFiles: $distType ..."

    case $distType in
    TEST)
        buildCommand="build-test"
        s3Bucket="$s3TestBucket"
        cfDistributionID="$cfTestDistribution"
        ;;
    BETA)
        buildCommand="build-beta"
        s3Bucket="$s3BetaBucket"
        cfDistributionID="$cfBetaDistribution"
        ;;
    PROD)
        buildCommand="build-prod"
        s3Bucket="$s3ProdBucket"
        ;;
    *)
        echo "Invalid distribution type!"
        return
        ;;
    esac

    echo "Building the distribution for $distType ..."

    npm run $buildCommand

    echo "Synchronizing files with $s3Bucket ..."

    pushd dist

    aws s3 sync \
    . s3://$s3Bucket \
    --delete \
    --profile appigo

    popd

    if [ -n "$cfDistributionID" ]
    then
        echo "Invalidating CloudFront files to update web cache..."

        aws cloudfront create-invalidation \
        --distribution-id "$cfDistributionID" \
        --paths "/*" \
        --profile appigo
    fi
}

function mainMenu {
    echo ""
    echo "Welcome to the Todo Cloud Angular 2 Deployment Tool!"
    echo ""
    echo "1. Publish a new version of the web app"
    echo ""
    read -p "Choose an option (<Enter> to quit):" -n 1 -s selectedOption
    echo ""

    if [ -z "$selectedOption" ]
    then
        echo "Goodbye!"
        exit 0
    else
        echo "You selected option #$selectedOption"
    fi

    case $selectedOption in
    1)
        chooseDeploymentType
        if [ -z "$deploymentType" ]
        then
            mainMenu
        fi
        syncFiles $deploymentType
        mainMenu
        ;;
    *)
        echo "Invalid option"
        mainMenu
esac
}

mainMenu

